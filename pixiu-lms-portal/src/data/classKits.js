// Canonical static curriculum hardware blueprints.
// This file is configuration, not student/application data. Runtime records remain server-authoritative in PostgreSQL.

export const CLASS_KITS = {
  '6': {
    class_grade: '6', kit_id: 'KIT-ZPS-6', name: 'Pixiu Discovery STEM & Robotics Core Kit (Class 6)', overview_image: '/img/kits/class6_p2_img1_1536x1024.jpeg', tagline: 'Microcontrollers, Traffic Signals, Light Sensors & Servo Barrier Systems', total_components: 12,
    components: [
      { id: 'C6-01', name: 'Arduino Uno R3 Microcontroller Board', image: '/img/kits/components/class6_part_1.jpg', qty: '1 Unit', role: 'The Brain controller for the project.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P, 5V, 14 Digital I/O, 6 Analog Inputs' },
      { id: 'C6-02', name: 'USB Type A-B Programming Cable', image: '/img/kits/components/class6_part_2.jpg', qty: '1 Pc', role: 'Carries programs to the board and powers it during testing.', session: 'Session 3', category: 'Interface', specs: 'USB A to USB B data interface' },
      { id: 'C6-03', name: '400-Point Solderless Breadboard', image: '/img/kits/components/class6_part_3.jpg', qty: '1 Pc', role: 'Solderless prototyping circuit base.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points with power rails' },
      { id: 'C6-04', name: 'Multi-Color Jumper Wire Harness', image: '/img/kits/components/class6_part_4.jpg', qty: '1 Set (30 Pcs)', role: 'Interconnects between circuit components.', session: 'Session 2', category: 'Wiring', specs: 'Mixed male/female jumper set' },
      { id: 'C6-05', name: '5mm Diffused LEDs (Red, Yellow, Green)', image: '/img/kits/components/class6_part_5.jpg', qty: '5 Pcs', role: 'Visual indicators for circuit outputs.', session: 'Session 2', category: 'Visual Output', specs: '5mm diffused LEDs' },
      { id: 'C6-06', name: '220Ω & 10KΩ Carbon Film Resistors', image: '/img/kits/components/class6_part_6.jpg', qty: '10 Pcs', role: 'Current limiting and pull-down components.', session: 'Session 2', category: 'Passive Component', specs: '1/4W, 5% tolerance' },
      { id: 'C6-07', name: 'Integrated Traffic Light Signal Module', image: '/img/kits/components/class6_part_7.jpg', qty: '1 Unit', role: 'Ready-made red/yellow/green signal module.', session: 'Session 7', category: 'Actuator / Display', specs: 'Common cathode signal module' },
      { id: 'C6-08', name: 'LDR Ambient Light Sensor Module', image: '/img/kits/components/class6_part_8.jpg', qty: '1 Unit', role: 'Measures ambient light as an analog signal.', session: 'Session 9', category: 'Sensor', specs: 'Photoresistor + LM393 comparator' },
      { id: 'C6-09', name: 'HC-SR04 Ultrasonic Sonar Sensor', image: '/img/kits/components/class6_part_9.jpg', qty: '1 Unit', role: 'Non-contact distance measurement.', session: 'Session 12', category: 'Sensor', specs: '2cm-400cm range, 5V logic' },
      { id: 'C6-10', name: 'SG90 Micro Servo Motor 90-180°', image: '/img/kits/components/class6_part_10.jpg', qty: '1 Unit', role: 'Precise-angle actuator for the barrier arm.', session: 'Session 12', category: 'Mechanical Actuator', specs: '9g servo, 180° positioning' },
      { id: 'C6-11', name: 'Piezoelectric Audio Buzzer Module', image: '/img/kits/components/class6_part_11.jpg', qty: '1 Unit', role: 'Acoustic warning output.', session: 'Session 13', category: 'Audio Output', specs: '5V active buzzer' },
      { id: 'C6-12', name: 'Tactile Momentary Push Switch', image: '/img/kits/components/class6_part_12.jpg', qty: '2 Pcs', role: 'Digital operator input switch.', session: 'Challenge Work', category: 'Input Switch', specs: '12mm tactile switch' }
    ]
  },
  '7': {
    class_grade: '7', kit_id: 'KIT-ZPS-7', name: 'Pixiu Environmental & Smart Automation Lab Kit (Class 7)', overview_image: '/img/kits/class7_p3_img1_1536x1024.jpeg', tagline: 'Climate Telemetry, Raindrop Sensors, Potentiometers & Servos', total_components: 12,
    components: [
      { id: 'C7-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class7_part_1.jpg', qty: '1 Unit', role: 'Controller for environmental and smart automation logic.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P, 16MHz, 5V' },
      { id: 'C7-02', name: 'USB A-B Cable', image: '/img/kits/components/class7_part_2.jpg', qty: '1 Pc', role: 'Program and power interface.', session: 'Session 3', category: 'Interface', specs: 'USB 2.0 A-B' },
      { id: 'C7-03', name: '400-Point Breadboard', image: '/img/kits/components/class7_part_3.jpg', qty: '1 Pc', role: 'Solderless circuit prototyping.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points' },
      { id: 'C7-04', name: 'Jumper Wire Set', image: '/img/kits/components/class7_part_4.jpg', qty: '1 Set (30 Pcs)', role: 'Circuit interconnects.', session: 'Session 2', category: 'Wiring', specs: 'Mixed jumper wires' },
      { id: 'C7-05', name: '5mm LED Indicators', image: '/img/kits/components/class7_part_5.jpg', qty: '5 Pcs', role: 'Status and alarm indicators.', session: 'Session 2', category: 'Visual Output', specs: '5mm LEDs' },
      { id: 'C7-06', name: '220Ω Resistors', image: '/img/kits/components/class7_part_6.jpg', qty: '10 Pcs', role: 'LED current limiting.', session: 'Session 2', category: 'Passive', specs: '220Ω metal film' },
      { id: 'C7-07', name: '10KΩ Rotary Potentiometer', image: '/img/kits/components/class7_part_7.jpg', qty: '1 Unit', role: 'Adjustable analog input.', session: 'Session 6', category: 'Analog Input', specs: 'Linear 10KΩ potentiometer' },
      { id: 'C7-08', name: 'DHT11 Temperature & Humidity Sensor', image: '/img/kits/components/class7_part_8.jpg', qty: '1 Unit', role: 'Measures temperature and humidity.', session: 'Session 9', category: 'Sensor', specs: 'Single-wire digital sensor' },
      { id: 'C7-09', name: 'Active Piezo Buzzer Module', image: '/img/kits/components/class7_part_9.jpg', qty: '1 Unit', role: 'Environmental alarm output.', session: 'Session 11', category: 'Audio Output', specs: '5V active buzzer' },
      { id: 'C7-10', name: 'Raindrop & Moisture Detection Plate', image: '/img/kits/components/class7_part_10.jpg', qty: '1 Unit', role: 'Rain and moisture detection.', session: 'Session 12', category: 'Sensor', specs: 'Rain plate + comparator module' },
      { id: 'C7-11', name: 'LDR Ambient Light Sensor Module', image: '/img/kits/components/class7_part_11.jpg', qty: '1 Unit', role: 'Detects illumination level.', session: 'Session 13', category: 'Sensor', specs: 'Analog/digital LDR module' },
      { id: 'C7-12', name: 'SG90 Micro Servo Actuator', image: '/img/kits/components/class7_part_12.jpg', qty: '1 Unit', role: 'Automated mechanical actuator.', session: 'Session 15', category: 'Actuator', specs: '9g servo, 180°' }
    ]
  },
  '8': {
    class_grade: '8', kit_id: 'KIT-ZPS-8', name: 'Pixiu Autonomous Robotics & Mobility Kit (Class 8)', overview_image: '/img/kits/class8_p2_img1_1536x1024.jpeg', tagline: 'Ultrasonic Sonar Scanning, Motor Drivers, BO Motors & Robotic Chassis', total_components: 12,
    components: [
      { id: 'C8-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class8_part_1.jpg', qty: '1 Unit', role: 'Central robotics controller.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P' },
      { id: 'C8-02', name: 'USB A-B Cable', image: '/img/kits/components/class8_part_2.jpg', qty: '1 Pc', role: 'Programming and debugging interface.', session: 'Session 3', category: 'Interface', specs: 'USB A-B' },
      { id: 'C8-03', name: '400-Point Breadboard', image: '/img/kits/components/class8_part_3.jpg', qty: '1 Pc', role: 'Sensor and driver wiring platform.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points' },
      { id: 'C8-04', name: 'Jumper Wire Set', image: '/img/kits/components/class8_part_4.jpg', qty: '1 Set (30 Pcs)', role: 'Signal interconnects.', session: 'Session 2', category: 'Wiring', specs: 'Mixed jumper set' },
      { id: 'C8-05', name: '5mm LED Bar Array', image: '/img/kits/components/class8_part_5.jpg', qty: '5 Pcs', role: 'Visual distance indicators.', session: 'Session 2', category: 'Visual Output', specs: '5mm LEDs' },
      { id: 'C8-06', name: '220Ω Resistors', image: '/img/kits/components/class8_part_6.jpg', qty: '10 Pcs', role: 'Status LED current limiting.', session: 'Session 2', category: 'Passive', specs: '220Ω resistors' },
      { id: 'C8-07', name: 'HC-SR04 Sonar Ultrasonic Sensor', image: '/img/kits/components/class8_part_7.jpg', qty: '1 Unit', role: 'Measures distance using acoustic echo.', session: 'Session 6', category: 'Sensor', specs: '2cm-400cm, 40kHz' },
      { id: 'C8-08', name: 'SG90 Sonar Turret Servo Motor', image: '/img/kits/components/class8_part_8.jpg', qty: '1 Unit', role: 'Rotates sonar for scanning.', session: 'Session 9', category: 'Actuator', specs: 'Micro servo' },
      { id: 'C8-09', name: 'Buzzer Warning Module', image: '/img/kits/components/class8_part_9.jpg', qty: '1 Unit', role: 'Proximity warning tone.', session: 'Session 10', category: 'Audio Output', specs: 'Piezo buzzer' },
      { id: 'C8-10', name: 'L298N Dual H-Bridge Motor Driver', image: '/img/kits/components/class8_part_10.jpg', qty: '1 Unit', role: 'Drives dual DC motors.', session: 'Session 12', category: 'Motor Driver', specs: 'Dual H-bridge, up to 2A peak/channel' },
      { id: 'C8-11', name: '100 RPM Geared BO Motors & Wheels (x2)', image: '/img/kits/components/class8_part_11.jpg', qty: '2 Motors + 2 Wheels', role: 'Drive system for the rover.', session: 'Session 13', category: 'Motors & Wheels', specs: '3-6V DC geared motors' },
      { id: 'C8-12', name: 'Robot Chassis, Caster Wheel & Battery Pack', image: '/img/kits/components/class8_part_12.jpg', qty: '1 Set', role: 'Mechanical platform and power.', session: 'Session 13', category: 'Mechanical Chassis', specs: 'Acrylic chassis + caster + battery holder' }
    ]
  },
  '9': {
    class_grade: '9', kit_id: 'KIT-ZPS-9', name: 'Pixiu Industrial Sensors & Autonomous Line Rover Kit (Class 9)', overview_image: '/img/kits/class9_p2_img1_1536x1024.jpeg', tagline: 'Infrared Flame Detectors, 16x2 LCD Telemetry, Dual IR Line Trackers & Rover', total_components: 16,
    components: [
      { id: 'C9-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class9_part_1.jpg', qty: '1 Unit', role: 'Central processing unit.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P' },
      { id: 'C9-02', name: 'USB A-B Cable', image: '/img/kits/components/class9_part_2.jpg', qty: '1 Pc', role: 'Programming and serial data link.', session: 'Session 3', category: 'Interface', specs: 'USB 2.0' },
      { id: 'C9-03', name: '400-Point Breadboard', image: '/img/kits/components/class9_part_3.jpg', qty: '1 Pc', role: 'Solderless prototyping platform.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points' },
      { id: 'C9-04', name: 'Jumper Wire Harness', image: '/img/kits/components/class9_part_4.jpg', qty: '1 Set (40 Pcs)', role: 'Multi-pin interconnect wiring.', session: 'Session 2', category: 'Wiring', specs: 'Mixed jumper wires' },
      { id: 'C9-05', name: '5mm Status LEDs', image: '/img/kits/components/class9_part_5.jpg', qty: '5 Pcs', role: 'Operational state indicators.', session: 'Session 2', category: 'Visual Output', specs: 'Diffused 5mm LEDs' },
      { id: 'C9-06', name: '220Ω & 10KΩ Resistors', image: '/img/kits/components/class9_part_6.jpg', qty: '10 Pcs', role: 'Current limiting and pull-down network.', session: 'Session 2', category: 'Passive', specs: 'Metal film resistors' },
      { id: 'C9-07', name: 'Optical Infrared Flame Sensor Module', image: '/img/kits/components/class9_part_7.jpg', qty: '1 Unit', role: 'Infrared flame detection.', session: 'Session 6', category: 'Sensor', specs: 'IR phototransistor + comparator' },
      { id: 'C9-08', name: 'DHT11 Temp & Humidity Module', image: '/img/kits/components/class9_part_8.jpg', qty: '1 Unit', role: 'Environmental telemetry.', session: 'Session 7', category: 'Sensor', specs: 'Digital temperature/humidity sensor' },
      { id: 'C9-09', name: 'Active Alarm Buzzer Module', image: '/img/kits/components/class9_part_9.jpg', qty: '1 Unit', role: 'Acoustic emergency output.', session: 'Session 7', category: 'Audio Output', specs: 'Active 5V piezo' },
      { id: 'C9-10', name: '2-Pin Reset Push Switch', image: '/img/kits/components/class9_part_10.jpg', qty: '2 Pcs', role: 'Reset/override input.', session: 'Session 8', category: 'Input Switch', specs: 'Tactile push switch' },
      { id: 'C9-11', name: '16x2 Alphanumeric LCD Display', image: '/img/kits/components/class9_part_11.jpg', qty: '1 Unit', role: 'Live sensor and robot telemetry display.', session: 'Session 9', category: 'Display', specs: 'HD44780, 16x2 LCD' },
      { id: 'C9-12', name: '10K LCD Contrast Potentiometer', image: '/img/kits/components/class9_part_12.jpg', qty: '1 Unit', role: 'LCD contrast calibration.', session: 'Session 10', category: 'Analog Input', specs: '10K trimmer' },
      { id: 'C9-13', name: 'LDR Ambient Light Sensor', image: '/img/kits/components/class9_part_13.jpg', qty: '1 Unit', role: 'Ambient light measurement.', session: 'Session 11', category: 'Sensor', specs: 'Photoresistor module' },
      { id: 'C9-14', name: 'Dual TCRT5000 IR Line Sensor Modules', image: '/img/kits/components/class9_part_14.jpg', qty: '2 Units (L & R)', role: 'Black/white line contrast tracking.', session: 'Session 12', category: 'Navigation Sensor', specs: 'Dual IR reflectance sensors' },
      { id: 'C9-15', name: 'L298N Dual Motor Driver Module', image: '/img/kits/components/class9_part_15.jpg', qty: '1 Unit', role: 'Differential steering motor driver.', session: 'Session 12', category: 'Motor Driver', specs: 'Dual H-bridge' },
      { id: 'C9-16', name: 'Line Follower Robot Chassis, Wheels & Power', image: '/img/kits/components/class9_part_16.jpg', qty: '1 Set', role: 'Mobile robot base and battery harness.', session: 'Session 13', category: 'Chassis & Power', specs: 'Acrylic chassis, motors, wheels, battery pack' }
    ]
  },
  '11': {
    class_grade: '11', kit_id: 'KIT-ZPS-11', name: 'Pixiu Advanced Photonics & Autonomous Maze Rover Kit (Class 11)', overview_image: '/img/kits/class11_p2_img1_1536x1024.jpeg', tagline: 'Collimated Laser Tripwires, Sonar Characterization, 3-Way Maze Array & Precision Rover', total_components: 16,
    components: [
      { id: 'C11-01', name: 'Arduino Uno R3 Microcontroller', image: '/img/kits/components/class11_part_1.jpg', qty: '1 Unit', role: 'MCU for optics, characterization and maze algorithms.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P, 16MHz' },
      { id: 'C11-02', name: 'USB A-B Interface Cable', image: '/img/kits/components/class11_part_2.jpg', qty: '1 Pc', role: 'Programming and telemetry interface.', session: 'Session 3', category: 'Interface', specs: 'Shielded USB A-B' },
      { id: 'C11-03', name: '400-Point Breadboard', image: '/img/kits/components/class11_part_3.jpg', qty: '1 Pc', role: 'Precision prototyping platform.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points' },
      { id: 'C11-04', name: 'Precision Jumper Wire Harness', image: '/img/kits/components/class11_part_4.jpg', qty: '1 Set (40 Pcs)', role: 'Sensor-array interconnects.', session: 'Session 2', category: 'Wiring', specs: 'Mixed jumper set' },
      { id: 'C11-05', name: '5mm Multi-State Indication LEDs', image: '/img/kits/components/class11_part_5.jpg', qty: '5 Pcs', role: 'Armed, warning, alarm and running indicators.', session: 'Session 2', category: 'Visual Output', specs: '5mm LEDs' },
      { id: 'C11-06', name: '220Ω & 10KΩ Precision Resistors', image: '/img/kits/components/class11_part_6.jpg', qty: '10 Pcs', role: 'Current limiting and pull-down network.', session: 'Session 2', category: 'Passive', specs: '1% metal film' },
      { id: 'C11-07', name: '5V 650nm Red Laser Dot Diode Module', image: '/img/kits/components/class11_part_7.jpg', qty: '1 Unit', role: 'Collimated optical beam emitter.', session: 'Session 6', category: 'Optics / Emitter', specs: '650nm, low-power module' },
      { id: 'C11-08', name: 'High-Sensitivity Optical LDR Receiver', image: '/img/kits/components/class11_part_8.jpg', qty: '1 Unit', role: 'Detects breaks in the optical beam.', session: 'Session 6', category: 'Optics / Sensor', specs: 'LDR module with threshold adjustment' },
      { id: 'C11-09', name: '16x2 Telemetry LCD Display', image: '/img/kits/components/class11_part_9.jpg', qty: '1 Unit', role: 'Live engineering telemetry screen.', session: 'Session 7', category: 'Display', specs: '16x2 HD44780 LCD' },
      { id: 'C11-10', name: '10K Contrast Potentiometer', image: '/img/kits/components/class11_part_10.jpg', qty: '1 Unit', role: 'Fine display contrast adjustment.', session: 'Session 7', category: 'Analog Input', specs: '10K pot' },
      { id: 'C11-11', name: 'High-Decibel Siren Buzzer', image: '/img/kits/components/class11_part_11.jpg', qty: '1 Unit', role: 'Intrusion/alarm annunciator.', session: 'Session 7', category: 'Audio Output', specs: 'Active piezo siren' },
      { id: 'C11-12', name: 'Tactile Latch Clear Switch', image: '/img/kits/components/class11_part_12.jpg', qty: '2 Pcs', role: 'Reset input for latched alarms.', session: 'Session 8', category: 'Input Switch', specs: '12mm tactile button' },
      { id: 'C11-13', name: 'HC-SR04 Sonar Distance Sensor', image: '/img/kits/components/class11_part_13.jpg', qty: '1 Unit', role: 'Distance instrument for calibration and uncertainty analysis.', session: 'Session 9', category: 'Sensor', specs: 'Ultrasonic distance sensor' },
      { id: 'C11-14', name: 'Triple IR Maze Sensor Array (Left, Centre, Right)', image: '/img/kits/components/class11_part_14.jpg', qty: '1 Set (3 Array)', role: 'Three-channel wall/path detection.', session: 'Session 12', category: 'Navigation Sensor Array', specs: '3x IR reflectance sensors' },
      { id: 'C11-15', name: 'L298N High-Torque Motor Driver', image: '/img/kits/components/class11_part_15.jpg', qty: '1 Unit', role: 'Bidirectional PWM motor control.', session: 'Session 13', category: 'Motor Driver', specs: 'Dual H-bridge' },
      { id: 'C11-16', name: 'Autonomous Maze Solver Chassis & Battery Power', image: '/img/kits/components/class11_part_16.jpg', qty: '1 Set', role: 'High-rigidity mobile platform and power.', session: 'Session 13', category: 'Chassis & Power', specs: 'Acrylic chassis, dual motors, caster, battery holder' }
    ]
  }
};
