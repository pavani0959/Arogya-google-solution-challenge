#include <TinyGPS++.h>
#include <SoftwareSerial.h>

// -------- GPS SETUP --------
TinyGPSPlus gps;
SoftwareSerial gpsSerial(4, 3); // TX, RX

// -------- ACCELEROMETER (SIMULATED) --------
float impactThreshold = 2.5;  // adjust for sensitivity
float simulatedImpact = 0;

// -------- STATE --------
bool accidentDetected = false;

void setup() {
  Serial.begin(9600);
  gpsSerial.begin(9600);

  Serial.println("🚑 Smart Helmet System Ready...");
}

void loop() {

  // -------- GPS READ --------
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // -------- SIMULATE IMPACT --------
  // Replace this with real sensor later
  simulatedImpact = random(10, 40) / 10.0; // generates 1.0 → 4.0

  if (simulatedImpact > impactThreshold) {
    accidentDetected = true;
  }

  // -------- IF LOCATION UPDATED --------
  if (gps.location.isUpdated()) {

    Serial.println("\n--------- LOCATION ---------");

    Serial.print("Latitude: ");
    Serial.println(gps.location.lat(), 6);

    Serial.print("Longitude: ");
    Serial.println(gps.location.lng(), 6);

    Serial.print("Maps Link: ");
    Serial.print("https://www.google.com/maps?q=");
    Serial.print(gps.location.lat(), 6);
    Serial.print(",");
    Serial.println(gps.location.lng(), 6);

    Serial.println("----------------------------");

    // -------- ACCIDENT LOGIC --------
    Serial.print("Impact Value: ");
    Serial.println(simulatedImpact);

    if (accidentDetected) {

      Serial.println("\n🚨 ACCIDENT DETECTED!");

      // -------- SEVERITY --------
      if (simulatedImpact > 3.5) {
        Serial.println("Severity: 🔴 CRITICAL");
      } else {
        Serial.println("Severity: 🟠 MEDIUM");
      }

      // -------- SOS OUTPUT --------
      Serial.println("📡 Sending SOS...");
      Serial.println("📞 Notifying Helpers & Ambulance...");

      // reset after trigger (for demo loop)
      accidentDetected = false;
    }
  }

  delay(2000);
}
