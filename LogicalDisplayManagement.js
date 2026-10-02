let body = document.querySelector('body')
//import elementStyles from './LogicalDisplayManagement.css' with { type: 'css'};

const inRange = (x) => {
  const num = parseInt(x, 10);
  return !isNaN(num) && num >= 1 && num <= 100;
};

function sendMqttUpdate(evtSource){
  const envelope = {
    Hostname: evtSource.closest('control-panel').getAttribute('hostname'),
    LogicalDisplay: evtSource.closest('control-panel').getAttribute('device'),
    [evtSource.parentElement.getAttribute("key")]: evtSource.value
  }
  console.debug('sendMqttUpdate', envelope)
  mqttClient.publish('vdgm/LogicalDisplays/Set',JSON.stringify(envelope))
} 

let mqttClientId = null
if (localStorage.mqttClientId == undefined){
  mqttClientId = 'mqttjs_' + Math.random().toString(16).substring(2, 8);
  localStorage.setItem('mqttClientId', mqttClientId)
}
else {
  mqttClientId = localStorage.mqttClientId
}
const connectUrl = 'ws://192.168.68.113:9001/mqtt'
const options = {
  keepalive: 60,
  mqttClientId: mqttClientId,
  clean: true,
  connectTimeout: 30 * 1000,
  reconnectPeriod: 1000,
}
const mqttClient = mqtt.connect(connectUrl, options)
const clientListening = "vdgm/"+mqttClientId+"/listener/#"
const listenerFeed = {
  "zigbee2mqtt/PirsensorOverloop": {qos: 0}, 
  "vdgm/LogicalDisplays/#": {qos: 0},
  [clientListening]: {qos: 0},
}

// class MockPirsensor extends HTMLElement {}

class DeviceHost extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const linkNode = document.createElement('link');
    linkNode.setAttribute('rel', 'stylesheet');
    linkNode.setAttribute('href', './LogicalDisplayManagement.css'); // Path to your file
    this.root.appendChild(linkNode);
  }
  
  connectedCallback(){
    this.titleRow   = this.root.appendChild(document.createElement('div'))
    this.legend     = this.titleRow.appendChild(document.createElement('legend'))
    this.WakeOnLan  = this.titleRow.appendChild(new WakeOnLanElement);

    this.titleRow.className = 'row'
  }
  setConfig(newConfig){
    console.debug(`${newConfig.hostname} HostConfig:`, newConfig)
    this.setAttribute('id', newConfig.hostname)
    this.legend.innerHTML = newConfig.hostname
    if ('macaddress' in newConfig){ 
      this.WakeOnLan.setAttribute('macaddress', newConfig.macaddress)
    }
    if ('ldm_client_pid' in newConfig){
      if (!this.querySelector('[class="client_pid"]')){        
        this.client_pid = this.titleRow.appendChild(document.createElement('span'))
        this.client_pid.classList.add('client_pid')
        this.client_pid.innerHTML = `client.pid: ${newConfig.ldm_client_pid}`  
      } else {
        this.client_pid.innerHTML = `client.pid: ${newConfig.ldm_client_pid}`
      }
    }
    if ('LogicalDisplays' in newConfig){
      if (newConfig.LogicalDisplays.length === 0){
        this.querySelectorAll('control-panel').forEach(ControlPanel => {
          ControlPanel.remove()
        })
      } else {
        newConfig.LogicalDisplays.forEach(PanelConfig => {
          if (!this.root.querySelector(`[device=${PanelConfig.DeviceName}]`)){
            const newControlPanel = this.root.appendChild(new ControlPanel)
            newControlPanel.setAttribute("hostname", newConfig.hostname)
            newControlPanel.setConfig(PanelConfig)
          } else {
            this.root.querySelector(`[device=${PanelConfig.DeviceName}]`).setConfig(PanelConfig)
          }
        })
      }
    }
  }
  setState(value){
    this.removeAttribute('state')
    this.legend.innerHTML = this.id
    if (value == "offline"){
      this.classList.add('offline')
      this.client_pid?.remove()
    }
    else {
      this.removeAttribute('class')
    }
    this.WakeOnLan.setAttribute('enabled', (value == 'offline'))
    this.querySelectorAll('control-panel').forEach(ControlPanel => {
      ControlPanel.setState(value)
    })
  }
  static get observedAttributes() {
    return ['state'];
  }
  attributeChangedCallback(type, oldValue, newValue) {
    switch (type) {
      case 'state':
        this.setState(newValue);
        break;
    }
  }
}

class ControlPanel extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback(){
  }
  setConfig(config){
    this.setAttribute('device', config.DeviceName)
    this.setAttribute('identifier', config.Identifier)

    this.device = config.DeviceName
    console.debug(`${this.getAttribute('hostname')} - ${config.DeviceName} - setConfig`, config)

    if ('config' in this){
      var oldConfig     = this.config
      var oldInput      = oldConfig.hasOwnProperty('CurrentInput')
      var oldBrightness = oldConfig.hasOwnProperty('CurrentBrightness')
      var oldContrast   = oldConfig.hasOwnProperty('CurrentContrast')
      var oldPowerState = 'CurrentPowerState' in oldConfig   //.hasOwnProperty('CurrentPowerState')''
    }

    if (config?.CurrentInput != null)
      if (!oldInput || config.CurrentInput != oldConfig.CurrentInput)
        this.setInput(config.CurrentInput, config.Identifier)

    if (config?.CurrentBrightness != null)
      if (!oldBrightness || config.CurrentBrightness != oldConfig.CurrentBrightness)
        this.setSlider('Brightness', config.CurrentBrightness) 
    
    if (config?.CurrentContrast != null)
      if (!oldContrast || config.CurrentContrast != oldConfig.CurrentContrast)
        this.setSlider('Contrast', config.CurrentContrast)

    this.config = config
  }


  setState(newValue){
     if (newValue != null){
  //  this.writeLog('setState', newValue)
      }
    if (newValue === "offline"){this.remove()}
  }
  setSlider(type, newValue){
  //  this.writeLog('setSlider', newValue, type)

    this.removeAttribute(type)
    if (!this.querySelector(`[key=${type}]`)){      
      this[type] = this.appendChild(new SliderControl)
      this[type].setAttribute('key', type)
      this[type].setAttribute('value', newValue)
    } else {
      this[type].setAttribute('value', newValue)
    }
  }
  setInput(newInput, Identifier){
  //  this.writeLog('setInput', newInput)
    if (!this.querySelector('input-selector')){
      this.InputSelector = this.appendChild(new InputSelector)
      this.InputSelector.setAttribute('value', newInput)
    } 
    else {
      this.InputSelector.setAttribute('value', newInput)
    }
  }
  static get observedAttributes() {
    return ['device', 'Brightness', 'Contrast'];
  }
  removeControl(control){
    let cpElement = this.querySelector(`[key="${control}"]`)
    console.log(cpElement)
    if (cpElement != null){
      this.removeChild(cpElement)
      }
  }

  attributeChangedCallback(type, oldValue, newValue) {
    switch (type) {
      case 'config': 
        this.setConfig(newValue, oldValue);
        break;
      case 'Brightness':
      case 'Contrast':
        this.setSlider(type, newValue);
        break;
    }
  }
}
class InputSelector extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback(){
    this.setAttribute("key", "Input")
    this.innerHTML = `
      <div key="Controls">
        <input id="powerOn" type="button" value="powerOn" title="powerOn">
        <input id="powerOff" type="button" value="powerOff" title="powerOff">
      </div>
      <div key="Input">
        <input id="inputHDMI" type="button" value="HDMI" title="inputHDMI">
        <input id="inputDisplayPort" type="button" value="DisplayPort" title="inputDisplayPort">
      </div>
      `
    const inputSelectors = this.querySelectorAll('input[type="button"]')
    inputSelectors.forEach(knop => {
      knop.addEventListener("click", function(event){
        sendMqttUpdate(event.srcElement)
      })
    })
  }
  setValue(value){
    if (value != null){
      this.querySelector('input#inputHDMI').classList.remove('active')
      this.querySelector('input#inputDisplayPort').classList.remove('active')
      this.querySelector(`input[value=${value}]`)?.classList.add('active')
    }
  }
  static get observedAttributes() {
    return ['value'];
  }
  attributeChangedCallback(type, oldValue, newValue) {
    switch (type) {
      case 'value': 
        this.setValue(newValue);
        break;
    }
  }
}
class SliderControl extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback(){
    this.label  = this.appendChild(document.createElement('label'))
    this.input  = this.appendChild(document.createElement('input'))
    this.output = this.appendChild(document.createElement('output'))
    this.input.type = 'range'
    this.input.min = '1'
    this.input.max = '100'
    this.input.output = this.output
    this.input.setValue = this.setValue
    this.input.addEventListener("change", function(event){
      event.srcElement.output.value = event.srcElement.value
      sendMqttUpdate(event.srcElement)
    })
  }
  setKey(Controltype){
    this.label.innerHTML = Controltype
    this.input.id = `${Controltype.toLowerCase()}_input`
//    this.label.htmlFor = this.input.id
  }
  setValue(Value){
    if (inRange(Value)){
      this.input.value = Value
      this.output.value = Value
    }
  }
  static get observedAttributes() {
    return ['key', 'value'];
  }
  attributeChangedCallback(type, oldValue, newValue) {
    switch (type) {
      case 'key':
        this.setKey(newValue);
        break;
      case 'value': 
        this.setValue(newValue);
        break;
    }
  }
}
class WakeOnLanElement extends HTMLInputElement {
  constructor() {super()}
  connectedCallback(){
    this.type = 'button'
    this.classList.add('active')
    this.value = 'WakeOnLan'
    this.innerText = 'WakeOnLan'
    this.addEventListener("click", function(event){
      const macaddress  = event.target.getAttribute('macaddress')
      const timestamp   = new Date().getTime().toString()
      mqttClient.publish('vdgm/WakeOnLan',`{"action":"on","macaddress":"${macaddress}","event_timestamp":${timestamp}}`)
    })
  }
  static get observedAttributes() {
    return ['macaddress', 'enabled'];
  }
  attributeChangedCallback(type, oldValue, newValue) {
    switch (type) {
      case 'macaddress': 
        this.macaddress = newValue
        break;
      case 'enabled':
        if (newValue == "false"){
          this.style.display = 'none'
        } else if (newValue == "true"){
          this.removeAttribute('style')
        }
    }
  }
}

customElements.define("device-host", DeviceHost)
customElements.define("control-panel", ControlPanel)
customElements.define("slider-control", SliderControl)
customElements.define("input-selector", InputSelector)
customElements.define("wake-on-lan-element", WakeOnLanElement, {extends: 'input'})

mqttClient.on('message', (topic, payload) => {
//  console.debug('topic: ', topic)
//  console.debug('payload: ', payload.toString())
  if (topic.toLowerCase().includes('logicaldisplays')){
    const newConfig = JSON.parse(payload.toString())
    if ('hostname' in newConfig){
      if (!body.querySelector(`[id=${newConfig.hostname}]`)){
        const newDeviceHost = body.appendChild(new DeviceHost)
        newDeviceHost.setConfig(newConfig)
      } 
      else {
        body.querySelector(`[id=${newConfig.hostname}]`).setConfig(newConfig)
      }
    }
    if ('state' in newConfig)
      body.querySelector(`[id=${newConfig.hostname}]`)?.setAttribute('state', newConfig.state)
    
  }
})

mqttClient.on('error', (err) => {
  console.log('Connection error: ', err)
  body.querySelector('[id=mqttFeedback]').innerHTML = `Mqtt client ${mqttClientId}, Connection error: ${err}`
  body.querySelectorAll('device-host').forEach(host => {
    host.classList.add('unreachable')
    host.setState('offline')
  })
  mqttClient.end()
})

mqttClient.on('reconnect', () => {
  body.querySelector('[id=mqttFeedback]').innerHTML = `Mqtt client ${mqttClientId} reconnecting`
})
const qos = 0

mqttClient.on('connect', () => {
  body.querySelector('[id=mqttFeedback]').innerHTML = `Mqtt client ${mqttClientId} connected`

  mqttClient.subscribe(listenerFeed, { qos }, (error) => {
    if (error) {
      console.log('Subscribe error:', error)
      return
    }
    console.log(`Subscribe to topic`, listenerFeed)
  })

  mqttClient.publish(`vdgm/${mqttClientId}`, 'WebSocket client online '+JSON.stringify(listenerFeed), { qos }, (error) => {
    if (error) {
      console.error(error)
    }
  })

  if (window.location.search != ''){
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    searchParams.get('host')
    searchParams.get('device')
    searchParams.get('input')

    const envelope = {
      Hostname: searchParams.get('host'),
      LogicalDisplay: searchParams.get('device'),
      Input: searchParams.get('input')
    }
    console.debug('sendMqttUpdate', envelope)
    mqttClient.publish('vdgm/LogicalDisplays/Set',JSON.stringify(envelope))

  }

})


    

    // https://github.com/mqttjs/MQTT.js#mqttclientstreambuilder-options
    // https://github.com/mqttjs/MQTT.js#mqttclientpublishtopic-message-options-callback
    // https://github.com/mqttjs/MQTT.js#mqttclientsubscribetopictopic-arraytopic-object-options-callback
    // https://github.com/mqttjs/MQTT.js#event-connect
    // https://github.com/mqttjs/MQTT.js#event-reconnect
    // https://github.com/mqttjs/MQTT.js#event-error
    // https://github.com/mqttjs/MQTT.js#event-message
