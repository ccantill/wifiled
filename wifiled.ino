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

#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>

WiFiUDP Udp;

CRGB leds[300];

const short udpPort = 2000;

void setup() {
//  Serial.begin(115200);
  WiFiManager wifiManager;
  wifiManager.autoConnect();

  Udp.begin(udpPort);

  if(MDNS.begin("wifiled")) {
    MDNS.addService("wifiled","udp", udpPort);
  }
 

  FastLED.addLeds<NEOPIXEL, 2>(leds, 300);

  for(int i = 0; i < 300; i++) {
    if(i) leds[i-1] = CRGB::Black;
    leds[i] = CRGB::White;
    FastLED.show();
    delay(30);
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
    if(len) {
//      Serial.print("Incoming packet, starting at led "); Serial.print(incomingPacket.offset); Serial.print(" for "); Serial.print(incomingPacket.numberOfColors); Serial.println(" leds");
      for(short i=0;i < incomingPacket.numberOfColors;i++) {
        leds[incomingPacket.offset + i] = incomingPacket.colors[i];
      }
      if(incomingPacket.refresh) {
//        Serial.println("Refreshing");
        FastLED.show();
      }
    }
  }
}
