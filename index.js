const { MilightController, commandsV6 } = require('node-milight-promise');

const controllers = {};

function getController(ip) {
  if (!controllers[ip]) {
    controllers[ip] = new MilightController({ ip, type: 'v6' });
  }
  return controllers[ip];
}

function sendWithRetry(controller, log, name, commands, retries = 3) {
  let attempt = 0;
  function tryOnce() {
    attempt++;
    return controller.ready()
      .then(() => controller.sendCommands(commands))
      .catch((err) => {
        if (attempt < retries) {
          log.warn(`[${name}] command failed (attempt ${attempt}/${retries}): ${err}. Retrying...`);
          return tryOnce();
        }
        throw err;
      });
  }
  return tryOnce();
}

function MiLightAccessory(log, api, bridgeIp, zoneConfig) {
  this.log = log;
  this.api = api;
  this.name = zoneConfig.name;
  this.zone = zoneConfig.zone;
  this.isBridgeLight = this.zone === 0;
  this.controller = getController(bridgeIp);

  this.state = { on: false, brightness: 100, hue: 0, saturation: 100 };

  const { Service, Characteristic } = api.hap;
  this.service = new Service.Lightbulb(this.name);

  this.service.getCharacteristic(Characteristic.On)
    .onGet(() => this.state.on)
    .onSet((value) => {
      this.state.on = value;
      const cmd = this.isBridgeLight
        ? (value ? commandsV6.bridge.on() : commandsV6.bridge.off())
        : (value ? commandsV6.fullColor.on(this.zone) : commandsV6.fullColor.off(this.zone));
      sendWithRetry(this.controller, this.log, this.name, cmd)
        .catch((err) => this.log.error(`[${this.name}] on/off error: ${err}`));
    });

  this.service.getCharacteristic(Characteristic.Brightness)
    .onGet(() => this.state.brightness)
    .onSet((value) => {
      this.state.brightness = value;
      const cmd = this.isBridgeLight
        ? commandsV6.bridge.brightness(value)
        : commandsV6.fullColor.brightness(this.zone, value);
      sendWithRetry(this.controller, this.log, this.name, cmd)
        .catch((err) => this.log.error(`[${this.name}] brightness error: ${err}`));
    });

  this.service.getCharacteristic(Characteristic.Hue)
    .onGet(() => this.state.hue)
    .onSet((value) => {
      this.state.hue = value;
      const milightHue = Math.round((value / 360) * 255);
      const cmd = this.isBridgeLight
        ? commandsV6.bridge.hue(milightHue)
        : commandsV6.fullColor.hue(this.zone, milightHue);
      sendWithRetry(this.controller, this.log, this.name, cmd)
        .catch((err) => this.log.error(`[${this.name}] hue error: ${err}`));
    });

  this.service.getCharacteristic(Characteristic.Saturation)
    .onGet(() => this.state.saturation)
    .onSet((value) => {
      this.state.saturation = value;
      if (value < 10) {
        const cmd = this.isBridgeLight ? commandsV6.bridge.whiteMode() : commandsV6.fullColor.whiteMode(this.zone);
        sendWithRetry(this.controller, this.log, this.name, cmd)
          .catch((err) => this.log.error(`[${this.name}] white mode error: ${err}`));
      }
    });

  this.informationService = new Service.AccessoryInformation()
    .setCharacteristic(Characteristic.Manufacturer, 'MiLight')
    .setCharacteristic(Characteristic.Model, this.isBridgeLight ? 'iBox v6 (Wifi Box light)' : 'iBox v6')
    .setCharacteristic(Characteristic.SerialNumber, `milight-zone-${this.zone}`);

  if (zoneConfig.forceOffOnStartup) {
    this.log.info(`[${this.name}] forceOffOnStartup enabled - sending off command.`);
    const offCmd = this.isBridgeLight ? commandsV6.bridge.off() : commandsV6.fullColor.off(this.zone);
    sendWithRetry(this.controller, this.log, this.name, offCmd)
      .then(() => this.log.info(`[${this.name}] startup off command confirmed.`))
      .catch((err) => this.log.error(`[${this.name}] startup off error: ${err}`));
  }
}

MiLightAccessory.prototype.getServices = function () {
  return [this.informationService, this.service];
};

function MiLightPlatform(log, config, api) {
  this.log = log;
  this.config = config || {};
  this.api = api;
}

MiLightPlatform.prototype.accessories = function (callback) {
  const bridgeIp = this.config.bridgeIp;
  const zoneConfigs = this.config.zones || [];
  const accessories = zoneConfigs.map(
    (zoneConfig) => new MiLightAccessory(this.log, this.api, bridgeIp, zoneConfig)
  );

  callback(accessories);
};

module.exports = (api) => {
  api.registerPlatform('homebridge-local-milight', 'LocalMilight', MiLightPlatform);
};
