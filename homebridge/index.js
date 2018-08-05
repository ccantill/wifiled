// Homebridge interface

"use strict";

var mdns = require('mdns');
var http = require('http');

var PlatformAccessory, Service, Characteristic, UUIDGen;

var rfComDevice;

function setupAccessory(acc, lampService) {
    if(!acc.context.lamp) {
        acc.context.lamp = {
            hue: 0,
            brightness: 0,
            saturation: 0,
            on: false
        };
    }

    let lamp = acc.context.lamp;

    function get_prop(characteristic, name) {
        return (callback) => callback(lamp[name]);
    }

    function set_prop(characteristic, name) {
        return (value, callback) => {
            lamp[name] = value;
            if(acc.context.ip) {
                if (lamp.on) {
                    http.get(`http://${acc.context.ip}/hsv?h=${Math.floor(lamp.hue * 255 / 360)}&s=${Math.floor(lamp.saturation * 255 / 100)}&v=${Math.floor(lamp.brightness * 255 / 100)}`);
                } else {
                    http.get(`http://${acc.context.ip}/off`);
                }
            }
            callback();
        }
    }

    function bind(characteristic, property) {
        lampService.getCharacteristic(characteristic).on('set', set_prop(characteristic, property));
        lampService.getCharacteristic(characteristic).on('get', get_prop(characteristic, property));
    }

    bind(Characteristic.Brightness, 'brightness');
    bind(Characteristic.Hue, 'hue');
    bind(Characteristic.Saturation, 'saturation');
    bind(Characteristic.On, 'on');
}

module.exports = function (homebridge) {
    console.log("homebridge API version: " + homebridge.version);

    // Accessory must be created from PlatformAccessory Constructor
    PlatformAccessory = homebridge.platformAccessory;

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    // Platform constructor
    // config may be null
    // api may be null if launched from old homebridge version
    class WiFiLedPlatform {
        constructor(log, config, api) {
            this.log = log;
            this.config = config;
            this.accessories = {};

            if (api) {
                // Save the API object as plugin needs to register new accessory via this object.
                this.api = api;

                // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
                // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
                // Or start discover new accessories
                this.api.on('didFinishLaunching', () => {
                    this.log("DidFinishLaunching");

                    var browser = mdns.createBrowser(mdns.udp("wifiled"));

                    browser.on('serviceUp', service => {
                        console.log("Device detected", service);
                        let uuid = UUIDGen.generate(service.name);
                        if(service.name in this.accessories) {
                            console.log("Reviving accessory");
                            let acc = this.accessories[service.name];
                            acc.context.ip = service.addresses[0];
                            acc.updateReachability(true);
                        } else {
                            console.log("Registering new accessory");
                            let acc = new PlatformAccessory(service.name, uuid);
                            acc.context.ip = service.addresses[0];
                            acc.context.name = service.name;

                            acc.updateReachability(true);
                            this.accessories[service.name] = acc;

                            let lampService = acc.addService(Service.Lightbulb);

                            setupAccessory(acc, lampService);

                            api.registerPlatformAccessories("homebridge-wifiled", "WiFiLedPlatform", [acc]);

                            console.log("Accessory registered");
                        }
                    });
                    browser.on('serviceDown', service => {
                        console.log("Service gone", service);
                        if(service.name in this.accessories) {
                            let acc = this.accessories[service.name];
                            acc.updateReachability(true);
                        }
                    });

                    browser.start();
                });
            }
        }

        configureAccessory(accessory) {
            setupAccessory(accessory, accessory.getService(Service.Lightbulb));
            this.accessories[accessory.context.name] = accessory;
            accessory.updateReachability(true);
        }
    }

    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-wifiled", "WiFiLedPlatform", WiFiLedPlatform, true);
};