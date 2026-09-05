/**
 * Official Curriculum Quizzes & Question Banks for Pixiu Robotics LMS
 * Level 0 through Level 5 with 4 options and detailed pedagogical reasoning.
 */

export const SEED_QUIZZES = [
  {
    id: 'QUIZ-L0',
    title: 'Level 0 Assessment: Fundamentals of Electronics & Breadboards',
    class_grade: '6',
    level: 'Level 0',
    unit_code: 'Unit 1',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L0-1',
        quiz_id: 'QUIZ-L0',
        question_order: 1,
        question_text: 'What is the primary role of a current-limiting resistor connected in series with an LED?',
        option_a: 'To increase the supply voltage',
        option_b: 'To protect the LED from burning out due to excessive current',
        option_c: 'To invert direct current into AC power',
        option_d: 'To amplify brightness indefinitely',
        correct_option: 'B',
        explanation: 'LEDs have very low internal resistance when forward-biased. A series resistor limits current to safe operating levels (typically 15-20mA), preventing thermal runaway and permanent burn-out.',
        points: 2
      },
      {
        id: 'Q-L0-2',
        quiz_id: 'QUIZ-L0',
        question_order: 2,
        question_text: 'On a standard solderless breadboard, how are the power rail holes connected?',
        option_a: 'Diagonally across the center divider',
        option_b: 'Horizontally in groups of 5 holes',
        option_c: 'Vertically throughout the entire continuous strip (+ and -)',
        option_d: 'They are completely isolated from each other',
        correct_option: 'C',
        explanation: 'Breadboard power rails (+ and -) run in continuous vertical columns along the outer edges to distribute VCC and GND across the entire board conveniently.',
        points: 2
      },
      {
        id: 'Q-L0-3',
        quiz_id: 'QUIZ-L0',
        question_order: 3,
        question_text: 'Which fundamental electrical law states the relationship V = I × R?',
        option_a: 'Faradays Law of Induction',
        option_b: 'Ohms Law',
        option_c: 'Coulombs Electrostatic Law',
        option_d: 'Kirchhoffs Current Law',
        correct_option: 'B',
        explanation: 'Ohms Law states that voltage (V) equals current (I) multiplied by resistance (R). It is the fundamental equation used to calculate resistor values in circuits.',
        points: 2
      },
      {
        id: 'Q-L0-4',
        quiz_id: 'QUIZ-L0',
        question_order: 4,
        question_text: 'How can you identify the positive terminal (Anode) of a brand new 5mm LED?',
        option_a: 'The anode has a shorter leg and flat rim notch',
        option_b: 'The anode has the longer leg and circular collar',
        option_c: 'The anode is always coated in black silicone',
        option_d: 'Both legs are always completely identical',
        correct_option: 'B',
        explanation: 'New LEDs have a longer lead for the Anode (positive) and a shorter lead with a flat notch on the plastic casing for the Cathode (negative/GND).',
        points: 2
      },
      {
        id: 'Q-L0-5',
        quiz_id: 'QUIZ-L0',
        question_order: 5,
        question_text: 'If two 220Ω resistors are connected in a single SERIES line, what is the total equivalent resistance?',
        option_a: '110Ω',
        option_b: '440Ω',
        option_c: '0Ω',
        option_d: '220Ω',
        correct_option: 'B',
        explanation: 'In a series circuit, individual resistances add up directly: R_total = R1 + R2 = 220Ω + 220Ω = 440Ω.',
        points: 2
      }
    ]
  },
  {
    id: 'QUIZ-L1',
    title: 'Level 1 Assessment: Arduino IDE, GPIO & C++ Programming',
    class_grade: '6',
    level: 'Level 1',
    unit_code: 'Unit 2',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L1-1',
        quiz_id: 'QUIZ-L1',
        question_order: 1,
        question_text: 'In an Arduino sketch, what is the key characteristic of the setup() function?',
        option_a: 'It repeats continuously in an infinite cycle',
        option_b: 'It runs exactly once when the board powers up or is reset',
        option_c: 'It is used only for drawing graphics on screen',
        option_d: 'It cannot configure digital pin directions',
        correct_option: 'B',
        explanation: 'setup() is called once when the sketch starts. It is used to initialize pin modes (pinMode), set baud rates (Serial.begin), and set initial variables.',
        points: 2
      },
      {
        id: 'Q-L1-2',
        quiz_id: 'QUIZ-L1',
        question_order: 2,
        question_text: 'Which Arduino C++ function configures digital pin 13 to supply power to an LED?',
        option_a: 'digitalRead(13, INPUT)',
        option_b: 'pinMode(13, OUTPUT)',
        option_c: 'analogWrite(13, 255)',
        option_d: 'setPinMode(13, HIGH)',
        correct_option: 'B',
        explanation: 'pinMode(pinNumber, OUTPUT) configures the specified digital pin to provide voltage output (+5V).',
        points: 2
      },
      {
        id: 'Q-L1-3',
        quiz_id: 'QUIZ-L1',
        question_order: 3,
        question_text: 'What does the function delay(1000) do in an Arduino sketch?',
        option_a: 'Pauses the processor execution for 1 second (1000 milliseconds)',
        option_b: 'Pauses the processor for 1 microsecond',
        option_c: 'Cycles an LED 1000 times',
        option_d: 'Increases the processor clock speed to 1000 MHz',
        correct_option: 'A',
        explanation: 'The parameter for delay() is specified in milliseconds. 1000 milliseconds equals exactly 1 second.',
        points: 2
      },
      {
        id: 'Q-L1-4',
        quiz_id: 'QUIZ-L1',
        question_order: 4,
        question_text: 'What voltage is present on digital pin 8 after calling digitalWrite(8, HIGH) on Arduino Uno?',
        option_a: '0 Volts (GND)',
        option_b: '3.3 Volts',
        option_c: '5.0 Volts',
        option_d: '12.0 Volts',
        correct_option: 'C',
        explanation: 'On 5V ATmega328P Arduino boards like the Uno and Nano, HIGH outputs +5V, while LOW outputs 0V (Ground).',
        points: 2
      },
      {
        id: 'Q-L1-5',
        quiz_id: 'QUIZ-L1',
        question_order: 5,
        question_text: 'Which punctuation mark is mandatory at the end of every executable instruction in Arduino C++?',
        option_a: 'A colon (:)',
        option_b: 'A semicolon (;)',
        option_c: 'A period (.)',
        option_d: 'An exclamation point (!)',
        correct_option: 'B',
        explanation: 'Every standalone C/C++ statement in Arduino must terminate with a semicolon (;), otherwise the compiler throws a syntax error.',
        points: 2
      }
    ]
  },
  {
    id: 'QUIZ-L2',
    title: 'Level 2 Assessment: Traffic Light Sequencer & Digital Logic',
    class_grade: '6',
    level: 'Level 2',
    unit_code: 'Unit 3',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L2-1',
        quiz_id: 'QUIZ-L2',
        question_order: 1,
        question_text: 'In an Indian standard 3-color traffic light sequencer, what is the correct state transition sequence?',
        option_a: 'Red -> Yellow -> Green -> Red',
        option_b: 'Red -> Green -> Yellow -> Red',
        option_c: 'Green -> Red -> Yellow -> Green',
        option_d: 'Yellow -> Red -> Green -> Yellow',
        correct_option: 'B',
        explanation: 'Standard traffic sequencing stops vehicles on Red, transitions to Green to allow movement, alerts drivers to prepare to stop on Yellow/Amber, then cycles back to Red.',
        points: 2
      },
      {
        id: 'Q-L2-2',
        quiz_id: 'QUIZ-L2',
        question_order: 2,
        question_text: 'Why is using long blocking delay() calls problematic in advanced robotics systems?',
        option_a: 'It reduces the flash memory of the microcontroller',
        option_b: 'It completely freezes the CPU, preventing sensors and emergency stops from responding',
        option_c: 'It drains the battery five times faster',
        option_d: 'It flips the polarity of the power supply',
        correct_option: 'B',
        explanation: 'delay() halts the CPU clock from processing any subsequent sensor readings or interrupts until the delay time completes, causing the robot to be blind to obstacles.',
        points: 2
      },
      {
        id: 'Q-L2-3',
        quiz_id: 'QUIZ-L2',
        question_order: 3,
        question_text: 'How many digital I/O pins are available on an Arduino Uno board?',
        option_a: '8 pins (0 to 7)',
        option_b: '14 pins (0 to 13)',
        option_c: '20 pins (0 to 19)',
        option_d: '6 pins (A0 to A5)',
        correct_option: 'B',
        explanation: 'The Arduino Uno has 14 digital input/output pins numbered 0 to 13 (of which 6 can also provide PWM output).',
        points: 2
      },
      {
        id: 'Q-L2-4',
        quiz_id: 'QUIZ-L2',
        question_order: 4,
        question_text: 'What role do pins 0 (RX) and 1 (TX) play on the Arduino board?',
        option_a: 'Analog audio inputs',
        option_b: 'Hardware Serial UART communication with PC over USB',
        option_c: 'Motor high-voltage drivers',
        option_d: 'Oscillator crystal connections',
        correct_option: 'B',
        explanation: 'Pins 0 (Receive) and 1 (Transmit) are dedicated to the ATmega hardware UART serial interface, connecting to the USB bridge chip.',
        points: 2
      },
      {
        id: 'Q-L2-5',
        quiz_id: 'QUIZ-L2',
        question_order: 5,
        question_text: 'What is the purpose of an active buzzer versus a passive buzzer in a pedestrian crosswalk circuit?',
        option_a: 'Active buzzers require no external frequency sketch; they sound immediately when given 5V',
        option_b: 'Passive buzzers are louder than active buzzers',
        option_c: 'Active buzzers only run on AC household current',
        option_d: 'There is no functional difference between them',
        correct_option: 'A',
        explanation: 'An active buzzer contains an internal oscillating circuit, producing a tone automatically when powered by DC 5V. A passive buzzer requires PWM tone() frequencies.',
        points: 2
      }
    ]
  },
  {
    id: 'QUIZ-L3',
    title: 'Level 3 Assessment: LDR Sensors, ADC & Automatic Lighting',
    class_grade: '6',
    level: 'Level 3',
    unit_code: 'Unit 4',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L3-1',
        quiz_id: 'QUIZ-L3',
        question_order: 1,
        question_text: 'How does the resistance of a Light Dependent Resistor (LDR / Photoresistor) change in the dark?',
        option_a: 'Its resistance drops to nearly zero ohms',
        option_b: 'Its resistance increases dramatically (often up to mega-ohms)',
        option_c: 'Its resistance remains constant at 100 ohms',
        option_d: 'Its resistance turns negative',
        correct_option: 'B',
        explanation: 'In the dark, fewer photons hit the semiconductor crystal, releasing fewer electron-hole pairs, causing LDR resistance to rise into hundreds of kilo-ohms or mega-ohms.',
        points: 2
      },
      {
        id: 'Q-L3-2',
        quiz_id: 'QUIZ-L3',
        question_order: 2,
        question_text: 'What integer range of values is returned by the Arduino analogRead() function?',
        option_a: '0 to 255 (8-bit)',
        option_b: '0 to 1023 (10-bit)',
        option_c: '0 to 65535 (16-bit)',
        option_d: '0 to 100 (percentage)',
        correct_option: 'B',
        explanation: 'The Arduino Uno ADC (Analog-to-Digital Converter) has 10-bit resolution, translating 0V to 5V into integer values from 0 to 1023 (2^10 = 1024 steps).',
        points: 2
      },
      {
        id: 'Q-L3-3',
        quiz_id: 'QUIZ-L3',
        question_order: 3,
        question_text: 'Why must an LDR be paired with a fixed resistor in a voltage divider circuit?',
        option_a: 'To protect the LDR from excessive sunlight',
        option_b: 'Microcontrollers can only measure voltage, not raw resistance directly',
        option_c: 'To step down 220V AC current',
        option_d: 'To prevent radio interference',
        correct_option: 'B',
        explanation: 'The Arduino analog pins measure voltage (0 to 5V). A voltage divider circuit converts the LDR variable resistance into a proportional variable voltage that analogRead() can digitize.',
        points: 2
      },
      {
        id: 'Q-L3-4',
        quiz_id: 'QUIZ-L3',
        question_order: 4,
        question_text: 'If analogRead(A0) outputs 300 in darkness and 850 in daylight, what is an optimal threshold to switch on a night lamp?',
        option_a: '100',
        option_b: '550',
        option_c: '950',
        option_d: '0',
        correct_option: 'B',
        explanation: 'A midpoint threshold around 550 ((300 + 850) / 2) creates a reliable switching boundary between daytime and night.',
        points: 2
      },
      {
        id: 'Q-L3-5',
        quiz_id: 'QUIZ-L3',
        question_order: 5,
        question_text: 'Which Arduino function outputs an 8-bit simulated analog voltage using Pulse Width Modulation (PWM)?',
        option_a: 'analogRead(pin)',
        option_b: 'analogWrite(pin, value)',
        option_c: 'pwmSet(pin, hz)',
        option_d: 'digitalWrite(pin, ANALOG)',
        correct_option: 'B',
        explanation: 'analogWrite(pin, 0-255) generates a PWM square wave on compatible pins (~3, ~5, ~6, ~9, ~10, ~11) to control LED brightness or motor speeds.',
        points: 2
      }
    ]
  },
  {
    id: 'QUIZ-L4',
    title: 'Level 4 Assessment: Ultrasonic Sensing & Servo Barrier Toll',
    class_grade: '6',
    level: 'Level 4',
    unit_code: 'Unit 5',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L4-1',
        quiz_id: 'QUIZ-L4',
        question_order: 1,
        question_text: 'On an HC-SR04 Ultrasonic distance sensor, what is the function of the Trig pin?',
        option_a: 'It sends out a 10-microsecond ultrasonic pulse trigger',
        option_b: 'It receives the reflected sonic echo',
        option_c: 'It powers the internal crystal oscillator',
        option_d: 'It connects to GND',
        correct_option: 'A',
        explanation: 'Sending a 10µs HIGH pulse to the Trig pin causes the sensor transmitter to emit an 8-cycle sonic burst at 40 kHz.',
        points: 2
      },
      {
        id: 'Q-L4-2',
        quiz_id: 'QUIZ-L4',
        question_order: 2,
        question_text: 'Why is the round-trip time returned by pulseIn(echoPin, HIGH) divided by 2 when calculating distance?',
        option_a: 'Because sound travels at half speed through air',
        option_b: 'Because the sound wave travels forward to the object and bounces back, doubling the distance',
        option_c: 'Because the Arduino clock runs at half speed',
        option_d: 'Because the echo pin has 50% duty cycle',
        correct_option: 'B',
        explanation: 'The sound wave travels to the obstacle and returns to the receiver. Dividing by 2 isolates the one-way distance to the target.',
        points: 2
      },
      {
        id: 'Q-L4-3',
        quiz_id: 'QUIZ-L4',
        question_order: 3,
        question_text: 'What type of motor is commonly used to actuate a smart toll booth barrier arm with precise angle control (0° to 90°)?',
        option_a: 'DC Motor without feedback',
        option_b: 'Stepper Motor with H-bridge',
        option_c: 'SG90 Micro Servo Motor',
        option_d: 'Solenoid valve',
        correct_option: 'C',
        explanation: 'Micro servo motors (like SG90) contain an internal potentiometer and feedback control circuit, allowing programmers to set exact barrier angles using servo.write(angle).',
        points: 2
      },
      {
        id: 'Q-L4-4',
        quiz_id: 'QUIZ-L4',
        question_order: 4,
        question_text: 'What library must be included in an Arduino sketch to control a standard servo motor?',
        option_a: '<EEPROM.h>',
        option_b: '<Servo.h>',
        option_c: '<Wire.h>',
        option_d: '<SoftwareSerial.h>',
        correct_option: 'B',
        explanation: 'The official <Servo.h> library generates the 50 Hz PWM pulse train required to position servo motors smoothly between 0° and 180°.',
        points: 2
      },
      {
        id: 'Q-L4-5',
        quiz_id: 'QUIZ-L4',
        question_order: 5,
        question_text: 'What is the speed of sound in dry air at room temperature (~20°C)?',
        option_a: '300,000 km/s',
        option_b: '343 meters per second (approx. 0.0343 cm/µs)',
        option_c: '1500 meters per second',
        option_d: '100 meters per second',
        correct_option: 'B',
        explanation: 'Sound travels at approximately 343 m/s (or ~29.1 microseconds per centimeter), which is the constant used in ultrasonic obstacle math.',
        points: 2
      }
    ]
  },
  {
    id: 'QUIZ-L5',
    title: 'Level 5 Assessment: Robotics Capstone, Motors & Troubleshooting',
    class_grade: '6',
    level: 'Level 5',
    unit_code: 'Unit 6',
    duration_minutes: 10,
    total_marks: 10,
    created_by: 'Pixiu Academic Faculty',
    status: 'Active',
    questions: [
      {
        id: 'Q-L5-1',
        quiz_id: 'QUIZ-L5',
        question_order: 1,
        question_text: 'In an autonomous line-follower robot, how does an IR sensor differentiate between a black track and white floor?',
        option_a: 'Black lines absorb infrared light, while white surfaces reflect infrared light back to the photodiode',
        option_b: 'Black lines generate higher voltage than white surfaces',
        option_c: 'White surfaces block magnetic fields',
        option_d: 'IR sensors cannot detect black surfaces',
        correct_option: 'A',
        explanation: 'Dark/black pigments absorb infrared radiation, resulting in negligible reflection to the phototransistor, while white surfaces reflect infrared strongly.',
        points: 2
      },
      {
        id: 'Q-L5-2',
        quiz_id: 'QUIZ-L5',
        question_order: 2,
        question_text: 'Why cannot high-power DC gear motors be powered directly from an Arduino digital pin?',
        option_a: 'Arduino digital pins can only supply up to 20-40mA, whereas motors draw hundreds of milliamperes, risking microcontroller burnout',
        option_b: 'Arduino digital pins only output AC voltage',
        option_c: 'Motors require negative voltage to turn',
        option_d: 'Digital pins do not support GND',
        correct_option: 'A',
        explanation: 'Microcontroller pins are low-current logic signals. Connecting a motor directly will exceed the ATmega pin current rating (40mA max) and destroy the chip. An H-bridge motor driver (like L298N or L293D) is required.',
        points: 2
      },
      {
        id: 'Q-L5-3',
        quiz_id: 'QUIZ-L5',
        question_order: 3,
        question_text: 'What circuit topology allows an H-bridge driver to reverse the rotational direction of a DC motor?',
        option_a: 'Four switching transistors arranged like the letter H that reverse the polarity across the motor terminals',
        option_b: 'A single diode connected in parallel',
        option_c: 'A potentiometer that changes resistance',
        option_d: 'A high-pass filter',
        correct_option: 'A',
        explanation: 'An H-bridge uses 4 switches (transistors/MOSFETs). Activating diagonal pairs flips current direction through the motor coils, reversing direction of rotation.',
        points: 2
      },
      {
        id: 'Q-L5-4',
        quiz_id: 'QUIZ-L5',
        question_order: 4,
        question_text: 'If your robot turns uncontrollably in circles when both motors are commanded forward, what is the most likely wiring cause?',
        option_a: 'The Arduino code has a syntax error',
        option_b: 'One motor polarity is inverted (+ and - reversed on the driver terminal)',
        option_c: 'The battery is at 100% capacity',
        option_d: 'The breadboard has too many jumper wires',
        correct_option: 'B',
        explanation: 'DC motors spin in reverse when their supply polarity is swapped. If one motor runs forward and the other runs backward, the robot spins in place.',
        points: 2
      },
      {
        id: 'Q-L5-5',
        quiz_id: 'QUIZ-L5',
        question_order: 5,
        question_text: 'What component protects microcontroller circuits from inductive voltage spikes generated when motor coils are turned off?',
        option_a: 'Flyback (Freewheeling) Diodes',
        option_b: 'Electrolytic capacitors only',
        option_c: 'Ceramic resistors',
        option_d: 'Light emitting diodes',
        correct_option: 'A',
        explanation: 'Inductive motor windings produce reverse high-voltage spikes (back-EMF) when current is cut. Flyback diodes safely redirect this energy back to the power rail.',
        points: 2
      }
    ]
  }
];

// Baseline Persistent Student Quiz Submissions (Permanent Completed Attempts)
export const SEED_QUIZ_SUBMISSIONS = [
  // ZPS6A 01 - Aarav Sharma (Completed Quizzes for Level 0, Level 1, Level 2)
  {
    id: 'SUB-ZPS6A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS6A 01',
    student_name: 'Aarav Sharma',
    class_grade: '6',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 245,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-22T11:15:00.000Z'
  },
  {
    id: 'SUB-ZPS6A01-L1',
    quiz_id: 'QUIZ-L1',
    student_id: 'ZPS6A 01',
    student_name: 'Aarav Sharma',
    class_grade: '6',
    level: 'Level 1',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L1-1': 'B',
      'Q-L1-2': 'B',
      'Q-L1-3': 'A',
      'Q-L1-4': 'C',
      'Q-L1-5': 'B'
    },
    time_taken_seconds: 310,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-26T11:20:00.000Z'
  },
  {
    id: 'SUB-ZPS6A01-L2',
    quiz_id: 'QUIZ-L2',
    student_id: 'ZPS6A 01',
    student_name: 'Aarav Sharma',
    class_grade: '6',
    level: 'Level 2',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L2-1': 'B',
      'Q-L2-2': 'B',
      'Q-L2-3': 'B',
      'Q-L2-4': 'B',
      'Q-L2-5': 'A'
    },
    time_taken_seconds: 280,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-29T11:35:00.000Z'
  },

  // ZPS6A 02 - Priya Patel
  {
    id: 'SUB-ZPS6A02-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS6A 02',
    student_name: 'Priya Patel',
    class_grade: '6',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 290,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-22T11:45:00.000Z'
  },

  // ZPS7A 01 - Devansh Tiwari
  {
    id: 'SUB-ZPS7A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS7A 01',
    student_name: 'Devansh Tiwari',
    class_grade: '7',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 210,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-23T10:30:00.000Z'
  },

  // ZPS8A 01 - Yash Srivastava
  {
    id: 'SUB-ZPS8A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS8A 01',
    student_name: 'Yash Srivastava',
    class_grade: '8',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 260,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-24T10:45:00.000Z'
  },

  // ZPS9A 01 - Ayush Kushwaha
  {
    id: 'SUB-ZPS9A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS9A 01',
    student_name: 'Ayush Kushwaha',
    class_grade: '9',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 240,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-24T11:15:00.000Z'
  },

  // ZPS11A 01 - Siddharth Pandey
  {
    id: 'SUB-ZPS11A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'ZPS11A 01',
    student_name: 'Siddharth Pandey',
    class_grade: '11',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 200,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-25T11:00:00.000Z'
  },

  // XYZ6A 01 - Aayush Maurya
  {
    id: 'SUB-XYZ6A01-L0',
    quiz_id: 'QUIZ-L0',
    student_id: 'XYZ6A 01',
    student_name: 'Aayush Maurya',
    class_grade: '6',
    level: 'Level 0',
    score: 10,
    total_marks: 10,
    percentage: 100,
    correct_count: 5,
    attempted_count: 5,
    total_questions: 5,
    answers: {
      'Q-L0-1': 'B',
      'Q-L0-2': 'C',
      'Q-L0-3': 'B',
      'Q-L0-4': 'B',
      'Q-L0-5': 'B'
    },
    time_taken_seconds: 330,
    violation_count: 0,
    status: 'Completed',
    reattempt_allowed: 0,
    completed_at: '2026-08-26T10:15:00.000Z'
  }
];
