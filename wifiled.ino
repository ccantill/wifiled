#include <ESP8266HTTPUpdateServer.h>

#include <ESP8266WebServer.h>

#define FASTLED_ALLOW_INTERRUPTS 0

#include <ESP8266mDNS.h>

#include <bitswap.h>
#include <chipsets.h>
#include <color.h>
#include <colorpalettes.h>
#include <colorutils.h>
#include <controller.h>
#include <cpp_compat.h>
#include <dmx.h>
#include <FastLED.h>
#include <fastled_config.h>
#include <fastled_delay.h>
#include <fastled_progmem.h>
#include <fastpin.h>
#include <fastspi.h>
#include <fastspi_bitbang.h>
#include <fastspi_dma.h>
#include <fastspi_nop.h>
#include <fastspi_ref.h>
#include <fastspi_types.h>
#include <hsv2rgb.h>
#include <led_sysdefs.h>
#include <lib8tion.h>
#include <noise.h>
#include <pixelset.h>
#include <pixeltypes.h>
#include <platforms.h>
#include <power_mgt.h>
#include <EEPROM.h>

#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>

#define EEPROM_ADDR_MAGIC_NUMBER 0
#define EEPROM_ADDR_DEFAULT_COLOR (EEPROM_ADDR_MAGIC_NUMBER + sizeof(int))

WiFiUDP Udp;

const short udpPort = 2000;
const short numberOfLeds = 300;
const unsigned int MAGIC_NUMBER = 0x42424020;

CRGB leds[numberOfLeds];

ESP8266WebServer httpServer(80);
ESP8266HTTPUpdateServer httpUpdater;

void handleRoot() {
  httpServer.send(200, "text/html", "<html><head><script src=\"http://ccantill.github.io/wifiled/webinterface.js\" language=\"javascript\"></script><link rel=\"stylesheet\" href=\"http://ccantill.github.io/wifiled/webinterface.css\"></link><title>WifiLed</title></head></html>");
}

void handleDevRoot() {
  httpServer.send(200, "text/html", "<html><head><script src=\"http://localhost:8080/wifiled/webinterface.js\" language=\"javascript\"></script><link rel=\"stylesheet\" href=\"http://localhost:8080/wifiled/webinterface.css\"></link><title>WifiLed</title></head></html>");
}

void setColor(CRGB color) {
  for (int i = 0; i < numberOfLeds; i++) {
    leds[i] = color;
  }
  FastLED.show();
}

void printColor(CRGB color) {
  Serial.print(color.r);
  Serial.print(",");
  Serial.print(color.g);
  Serial.print(",");
  Serial.println(color.b);
}

void setDefaultColor(CRGB color) {
  Serial.print("Changing default color to ");
  printColor(color);
  setColor(color);
  EEPROM.put(EEPROM_ADDR_DEFAULT_COLOR, color);
}

void restoreDefaultColor() {
  CRGB color;
  Serial.print("Restoring default color ");
  printColor(color);
  EEPROM.get(EEPROM_ADDR_DEFAULT_COLOR, color);
  setColor(color);
}

void handleSetRgb() {
  int r,g,b;
  if(
    sscanf(httpServer.arg("r").c_str(), "%d", &r) == 1 &&
    sscanf(httpServer.arg("g").c_str(), "%d", &g) == 1 &&
    sscanf(httpServer.arg("b").c_str(), "%d", &b) == 1)
  {
    CRGB color;
    // sscanf directly to byte values doesn't seem to work on ESP
    color.r = r;
    color.g = g;
    color.b = b;
    if(httpServer.hasArg("default")) {
      setDefaultColor(color);
    } else {
      setColor(color);
    }
    httpServer.send(200, "text/plain", "OK");
  } else {
    httpServer.send(400, "text/plain", "Invalid Request");
  }
}

void handleSetHsv() {
  int h,s,v;
  if(
    sscanf(httpServer.arg("h").c_str(), "%d", &h) == 1 &&
    sscanf(httpServer.arg("s").c_str(), "%d", &s) == 1 &&
    sscanf(httpServer.arg("v").c_str(), "%d", &v) == 1)
  {
    CRGB color = CHSV(h,s,v);
    if(httpServer.hasArg("default")) {
      setDefaultColor(color);
    } else {
      setColor(color);
    }
    httpServer.send(200, "text/plain", "OK");
  } else {
    httpServer.send(400, "text/plain", "Invalid Request");
  }
}

void handleTurnOff() {
  setColor(CRGB::Black);
  httpServer.send(200, "text/plain", "OK");
}

void handleTurnOn() {
  restoreDefaultColor();
  httpServer.send(200, "text/plain", "OK");
}

// Checks the magic number at EEPROM address 0 and clears the EEPROM if it's not right
void initEeprom() {
  int magicNumber;
  Serial.println("Checking magic number");
  EEPROM.get(EEPROM_ADDR_MAGIC_NUMBER, magicNumber);
  if (magicNumber != MAGIC_NUMBER) {
    Serial.println("Resetting EEPROM");
    EEPROM.put(EEPROM_ADDR_MAGIC_NUMBER, magicNumber);
    CRGB d = CRGB::White;
    EEPROM.put(EEPROM_ADDR_DEFAULT_COLOR, d);
  }
}

void setup() {
  String hostname = "WL-" + String(ESP.getChipId(), HEX);
  WiFi.hostname(hostname);
  
  Serial.begin(115200);
  FastLED.addLeds<NEOPIXEL, 2>(leds, numberOfLeds);
  
  initEeprom();
  restoreDefaultColor();

  WiFiManager wifiManager;
  wifiManager.autoConnect();

  Udp.begin(udpPort);

  httpUpdater.setup(&httpServer);
  httpServer.on("/", handleRoot);
  httpServer.on("/dev", handleDevRoot);
  httpServer.on("/rgb", handleSetRgb);
  httpServer.on("/hsv", handleSetHsv);
  httpServer.on("/off", handleTurnOff);
  httpServer.on("/on",  handleTurnOn);

  httpServer.begin();

  if (MDNS.begin(hostname.c_str())) {
    MDNS.addService("wifiled", "udp", udpPort);
    MDNS.addService("http", "tcp", 80);
  }
}

struct LedCommand {
  short offset;
  short numberOfColors;
  boolean refresh;
  CRGB colors[80];
};

LedCommand incomingPacket;

void loop() {
  // put your main code here, to run repeatedly:
  int packetSize = Udp.parsePacket();
  if (packetSize) {
    int len = Udp.read((char*)&incomingPacket, packetSize);
    if (len) {
      for (short i = 0; i < incomingPacket.numberOfColors && i < numberOfLeds; i++) {
        leds[incomingPacket.offset + i] = incomingPacket.colors[i];
      }
      if (incomingPacket.refresh) {
        FastLED.show();
      }
    }
  }
  httpServer.handleClient();
}
