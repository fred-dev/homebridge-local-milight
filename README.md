# homebridge-local-milight

Minimal local Homebridge platform plugin for a MiLight/LimitlessLED v6 WiFi bridge (iBox), talking to it
directly over UDP via [node-milight-promise](https://github.com/mwittig/node-milight-promise). Written
because no maintained Homebridge plugin exists for the real v6 bridge protocol (as opposed to the
ESP8266-based "Milight Hub").

Each configured zone becomes a HomeKit Lightbulb accessory (On/Off, Brightness, Hue; Saturation below 10
switches the zone to white mode). Zone `0` is the bridge's own built-in light ("Wifi Box"), which uses a
different command set internally (`commandsV6.bridge.*` instead of `commandsV6.fullColor.*`) - handled
automatically.

## Install

```bash
npm install
sudo npm install -g .
```

Install from a path that survives reboots and OS upgrades - not `/tmp`.

## Config

Add to Homebridge's `config.json`:

```json
{
  "platform": "LocalMilight",
  "name": "MiLight",
  "bridgeIp": "192.168.1.56",
  "zones": [
    { "name": "MiLight Bridge Light", "zone": 0, "forceOffOnStartup": true },
    { "name": "MiLight Zone 1", "zone": 1 },
    { "name": "MiLight Zone 2", "zone": 2 },
    { "name": "MiLight Zone 3", "zone": 3 },
    { "name": "MiLight Zone 4", "zone": 4 }
  ]
}
```

- `bridgeIp`: the MiLight iBox's IP address.
- `zones`: one entry per zone. `zone: 0` is the bridge's own light.
- `forceOffOnStartup` (optional, per zone): sends an off command every time Homebridge starts, so that
  zone resets to off after a power loss instead of resuming whatever state it was last left in.

Commands retry up to 3 times on UDP timeout, since the MiLight v6 protocol's flow control occasionally
drops packets over WiFi.
