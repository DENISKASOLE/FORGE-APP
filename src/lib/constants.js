export const DENIS_EMAIL = "kendenisdubai@gmail.com";

export const GOAL_OPTIONS = [
  "Fat Loss",
  "Muscle Gain",
  "Strength",
  "Endurance",
  "Mobility",
  "General Fitness",
  "Rehab",
  "Lifestyle",
];
export const CLIENT_TYPES = ["1:1", "Online"];
export const DEFAULT_CHECKIN_QUESTIONS = [
  { id: "q1", text: "What's your current weight? (kg)", type: "text" },
  { id: "q9", text: "Roughly what % was your nutrition adherence this week?", type: "choice", options: ["90-100%", "75-89%", "50-74%", "Below 50%"] },
  { id: "q2", text: "Energy this week", type: "choice", options: ["Struggling", "Steady", "Strong", "Crushing It"] },
  { id: "q3", text: "How was your sleep this week?", type: "choice", options: ["Poor", "Fair", "Good", "Excellent"] },
  { id: "q4", text: "Stuck to your program this week", type: "choice", options: ["Struggling", "Steady", "Strong", "Crushing It"] },
  { id: "q10", text: "Any exercises causing pain or discomfort?", type: "text" },
  { id: "q5", text: "What's your biggest win this week?", type: "text" },
  { id: "q6", text: "What was your biggest challenge this week?", type: "text" },
  { id: "q7", text: "Anything your coach should know?", type: "text" },
];
export const CLIENT_COLORS = [
  "#E8C547",
  "#4ECDC4",
  "#A78BFA",
  "#6EE7B7",
  "#FB923C",
  "#60A5FA",
  "#F472B6",
  "#F97316",
  "#22D3EE",
  "#84CC16",
  "#C084FC",
];
export const LIFT_FIELDS = [
  { key: "benchPress", label: "Bench" },
  { key: "squat", label: "Squat" },
  { key: "deadlift", label: "Deadlift" },
  { key: "ohp", label: "OHP" },
  { key: "deadHang", label: "Dead Hang" },
];
export const DEFAULT_INTAKE_QUESTIONS = [
  { id: "i1", text: "What are your main goals?" },
  { id: "i2", text: "Any injuries or medical conditions I should know about?" },
  { id: "i3", text: "Current training experience?" },
  { id: "i4", text: "How many days per week can you train?" },
  { id: "i5", text: "Any foods you avoid or dietary restrictions?" },
];

export const DEFAULT_TIME_SLOTS = ["5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"];
export const RPE_OPTIONS = ["", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
export const PHOTO_TYPES = ["Front", "Side", "Back", "Before", "After", "Progress", "Other"];
export const WATER_LITERS = ["", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6"];
export const SLEEP_HOURS = ["", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
export const MEASUREMENT_FIELDS = [
  ["bloodPressure", "Blood Pressure"],
  ["bmi", "BMI"],
  ["chest", "Chest"],
  ["leftArm", "Left Arm"],
  ["rightArm", "Right Arm"],
  ["waist", "Waist"],
  ["sternum", "Sternum"],
  ["stomach", "Stomach"],
  ["hip", "Hip"],
  ["waistHipRatio", "Waist To Hip Ratio"],
  ["push", "Push Strength"],
  ["pull", "Pull Strength"],
  ["leg", "Leg Strength"],
  ["core", "Core Strength"],
  ["cardio", "Cardio Fitness"],
];
export const TIMED_EXERCISES = ["dead hang", "scapular pull-up", "plank", "side plank", "weighted plank", "rkc plank", "hollow hold", "wall sit", "farmer walk", "farmer's carry", "suitcase carry", "overhead carry", "waiter carry", "sled push", "sled pull", "battle ropes", "battle rope waves", "battle rope slams", "skierg", "elliptical", "rower", "rowing machine", "stair climber", "stairmaster", "assault bike", "air bike", "stationary bike", "treadmill", "incline treadmill", "versa climber", "versaclimber", "jump rope", "bear crawl", "crab walk", "copenhagen", "hollow rock", "pallof hold", "deep squat hold", "goblet squat hold", "stretch", "stretching", "mobility", "carry"];
