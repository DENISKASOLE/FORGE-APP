-- Exercise library redesign, step 2: data seed for the ~396 built-in
-- exercises, plus a best-effort tagging pass over existing custom exercises.
-- REVIEW BEFORE RUNNING. Requires 20260910120000_exercise_taxonomy_schema.sql
-- to have been run first. Idempotent - safe to re-run (upserts by name).
--
-- Part A seeds public.exercise_library with muscle_group, movement_pattern,
-- and exactly 3 coaching_cues for every exercise in the app's built-in list
-- (src/features/train/exerciseLibraryData.js). needs_review = true on any
-- row the coach should spot-check (see DECISIONS.md on
-- feature/exercise-library for the full list and why each was flagged -
-- mostly generic cardio machines and mobility-flow drills that don't map
-- cleanly onto a single muscle group / strength movement pattern).
--
-- Part B is a best-effort pass over ALREADY-EXISTING custom exercises
-- (trainer_data rows, section='custom_exercise_library', a JSONB
-- {items:[{id,name,videoUrl},...]} blob per trainer - see loadExerciseLibraryData()
-- in src/features/train/TrainScreens.jsx). I could not read real trainer
-- data to hand-tag these (the anon key used for read-only investigation is
-- correctly blocked by RLS from seeing other trainers' rows), so this
-- applies the SAME keyword-matching heuristic used to help build Part A,
-- run live in SQL against whatever custom exercise names actually exist at
-- migration time. It always sets needs_review = true on every custom
-- exercise it touches (matched or not), since none of these were verified
-- by a human. Every custom exercise gets a name-based best-effort tag; none
-- are left without muscle_group/movement_pattern/3 cues. Going forward,
-- Step 3 (add/edit exercise form) requires these fields at creation time,
-- so no future custom exercise will ever need this heuristic.

-- ---------- Part A: built-in exercise library ----------
insert into public.exercise_library (name, muscle_group, movement_pattern, coaching_cues, needs_review)
values
  ('Barbell Bench Press', 'Chest', 'Horizontal push', ARRAY['Pin shoulder blades back and down on the bench', 'Lower the bar to mid-chest, elbows tucked ~45°', 'Drive through your feet, don''t let elbows flare']::text[], false),
  ('Flat Barbell Bench Press', 'Chest', 'Horizontal push', ARRAY['Set feet flat, arch slightly, blades pinned back', 'Bar path touches mid-chest, forearms stay vertical', 'Press up and slightly back, don''t bounce off chest']::text[], false),
  ('Close-Grip Bench Press', 'Triceps', 'Horizontal push', ARRAY['Grip just inside shoulder width, wrists stacked over elbows', 'Keep elbows tucked tight to your ribs throughout', 'Lower to lower chest, don''t let elbows flare out']::text[], false),
  ('Wide-Grip Bench Press', 'Chest', 'Horizontal push', ARRAY['Grip wider than shoulder width, wrists straight', 'Shorten the range, touch upper-mid chest', 'Don''t let shoulders round forward off the bench']::text[], false),
  ('Paused Bench Press', 'Chest', 'Horizontal push', ARRAY['Set up exactly as a normal bench press', 'Pause the bar dead-still on your chest for 1-2s', 'Don''t bounce out of the pause, drive smoothly']::text[], false),
  ('Tempo Bench Press', 'Chest', 'Horizontal push', ARRAY['Set up as a standard bench press', 'Lower under control for the prescribed count', 'Keep tension throughout, don''t rush the lockout']::text[], false),
  ('Incline Barbell Bench Press', 'Chest', 'Horizontal push', ARRAY['Set bench to 15-30°, don''t go too steep', 'Lower the bar to your upper chest/clavicle', 'Keep elbows tucked, avoid flaring at the bottom']::text[], false),
  ('Decline Barbell Bench Press', 'Chest', 'Horizontal push', ARRAY['Secure feet/legs under the pads before unracking', 'Lower the bar to your lower chest', 'Control the descent, don''t let it drop fast']::text[], false),
  ('Smith Machine Bench Press', 'Chest', 'Horizontal push', ARRAY['Position the bench so the bar tracks over mid-chest', 'Lower under control, touch mid-chest lightly', 'Don''t let the fixed bar path pull your shoulders forward']::text[], false),
  ('Smith Machine Incline Press', 'Chest', 'Horizontal push', ARRAY['Set bench to 15-30° under the bar', 'Lower to upper chest, elbows tucked', 'Keep wrists stacked over elbows through the fixed path']::text[], false),
  ('Machine Chest Press', 'Chest', 'Horizontal push', ARRAY['Set seat so handles align with mid-chest', 'Press forward without shrugging shoulders up', 'Control the return, don''t let the weight stack slam']::text[], false),
  ('Plate-Loaded Chest Press', 'Chest', 'Horizontal push', ARRAY['Adjust seat height to align handles with chest', 'Press smoothly, avoid locking out with a jerk', 'Keep shoulder blades pinned on the pad']::text[], false),
  ('Seated Chest Press', 'Chest', 'Horizontal push', ARRAY['Sit tall, handles level with mid-chest', 'Press straight out without arching off the pad', 'Squeeze at full extension, control the way back']::text[], false),
  ('Hammer Strength Chest Press', 'Chest', 'Horizontal push', ARRAY['Set seat so handles start at chest level', 'Press each arm through a full, even range', 'Don''t let one side lead and twist your torso']::text[], false),
  ('Dumbbell Bench Press', 'Chest', 'Horizontal push', ARRAY['Kick the dumbbells up to start position with your knees', 'Lower with elbows at ~45°, chest stretch at the bottom', 'Press up and slightly in, don''t clang the bells together']::text[], false),
  ('Flat DB Chest Press', 'Chest', 'Horizontal push', ARRAY['Set up on a flat bench, feet planted', 'Lower to a full stretch at chest level', 'Keep control at the bottom, don''t bounce the dumbbells']::text[], false),
  ('Incline DB Chest Press', 'Chest', 'Horizontal push', ARRAY['Set bench to 15-30°, dumbbells start over upper chest', 'Lower to a stretch at your upper chest', 'Don''t let elbows flare past 45° at the bottom']::text[], false),
  ('Decline DB Chest Press', 'Chest', 'Horizontal push', ARRAY['Secure your legs under the decline pads first', 'Lower to your lower chest under control', 'Keep wrists straight, don''t let dumbbells drift back']::text[], false),
  ('Neutral-Grip DB Press', 'Chest', 'Horizontal push', ARRAY['Hold dumbbells palms-facing, knuckles pointing up', 'Press in a straight vertical line over the chest', 'Keep elbows closer to the body than a standard press']::text[], false),
  ('Single-Arm DB Chest Press', 'Chest', 'Horizontal push', ARRAY['Brace your core hard to resist rotating', 'Press one arm through a full range', 'Don''t let the free side of your torso twist up']::text[], false),
  ('Dumbbell Fly', 'Chest', 'Isolation', ARRAY['Start with a slight bend in the elbows, palms in', 'Lower in a wide arc until you feel a chest stretch', 'Don''t straighten the elbows or turn it into a press']::text[], false),
  ('Incline Dumbbell Fly', 'Chest', 'Isolation', ARRAY['Set bench to 15-30°, slight elbow bend held fixed', 'Lower in an arc to a stretch across the upper chest', 'Bring dumbbells together over your chest, not your face']::text[], false),
  ('Decline Dumbbell Fly', 'Chest', 'Isolation', ARRAY['Secure legs on a decline bench', 'Lower in a wide arc to a lower-chest stretch', 'Keep the elbow bend constant through the whole rep']::text[], false),
  ('Cable Crossover', 'Chest', 'Isolation', ARRAY['Set pulleys high, step forward into a slight lean', 'Bring hands together in front of your chest in an arc', 'Keep a soft elbow bend, don''t turn it into a press']::text[], false),
  ('High-to-Low Cable Fly', 'Chest', 'Isolation', ARRAY['Set pulleys above shoulder height', 'Pull hands down and together toward your hips', 'Focus the squeeze on lower chest, not your shoulders']::text[], false),
  ('Low-to-High Cable Fly', 'Chest', 'Isolation', ARRAY['Set pulleys at or below hip height', 'Pull hands up and together toward eye level', 'Drive with your upper chest, don''t shrug into it']::text[], false),
  ('Standing Cable Chest Press', 'Chest', 'Horizontal push', ARRAY['Split stance, cable handles at chest height', 'Press straight forward, squeeze at full extension', 'Keep your torso still, don''t lean into the press']::text[], false),
  ('Pec Deck Fly', 'Chest', 'Isolation', ARRAY['Set seat so handles align with chest height', 'Bring pads/handles together in a hugging motion', 'Control the stretch back, don''t let the weight yank you']::text[], false),
  ('Machine Fly', 'Chest', 'Isolation', ARRAY['Adjust seat so arms start level with shoulders', 'Squeeze hands together through a full arc', 'Don''t let momentum carry the last few inches']::text[], false),
  ('Push-Up', 'Chest', 'Horizontal push', ARRAY['Hands just outside shoulder width, body in one line', 'Lower until chest nearly touches the floor', 'Don''t let your hips sag or pike up']::text[], false),
  ('Incline Push-Up', 'Chest', 'Horizontal push', ARRAY['Hands on an elevated surface, body straight', 'Lower chest to the surface under control', 'Keep hips in line, don''t let them rise first']::text[], false),
  ('Decline Push-Up', 'Chest', 'Horizontal push', ARRAY['Feet elevated, hands under shoulders', 'Lower until upper chest nearly touches the floor', 'Brace your core so hips don''t sag']::text[], false),
  ('Weighted Push-Up', 'Chest', 'Horizontal push', ARRAY['Have plate/vest secured before starting reps', 'Keep the same strict form as bodyweight push-ups', 'Don''t let added load cause your hips to sag']::text[], false),
  ('Deficit Push-Up', 'Chest', 'Horizontal push', ARRAY['Hands on blocks/plates for extra range', 'Lower chest below hand level for a deep stretch', 'Control the bottom, don''t drop into the stretch']::text[], false),
  ('Diamond Push-Up', 'Triceps', 'Horizontal push', ARRAY['Form a diamond with thumbs and index fingers', 'Keep elbows tucked tight to your ribs', 'Don''t let elbows flare out to the sides']::text[], false),
  ('TRX Push-Up', 'Chest', 'Horizontal push', ARRAY['Set handles at chest height, body in a plank', 'Lower under control, straps stay even', 'Keep core braced so you don''t sag or twist']::text[], false),
  ('Medicine Ball Push-Up', 'Chest', 'Horizontal push', ARRAY['One hand on the ball, one on the floor', 'Lower evenly, keep hips square', 'Don''t let the ball roll or your torso rotate']::text[], false),
  ('Chest Dips', 'Chest', 'Vertical push', ARRAY['Lean torso forward, elbows flare slightly out', 'Lower until you feel a deep chest stretch', 'Don''t drop too low and stress the shoulder joint']::text[], false),
  ('Assisted Chest Dips', 'Chest', 'Vertical push', ARRAY['Set assistance so you can control full range', 'Lean forward, lower to a chest stretch', 'Reduce assistance over time, don''t rely on momentum']::text[], false),
  ('Machine Dips', 'Chest', 'Vertical push', ARRAY['Set seat/handle height for a full range of motion', 'Lean forward slightly and lower under control', 'Don''t let the weight stack drop you into the bottom']::text[], false),
  ('Pull-Up', 'Back', 'Vertical pull', ARRAY['Start from a dead hang, shoulder blades set', 'Pull your chest up toward the bar, elbows down and back', 'Don''t kip or swing to generate momentum']::text[], false),
  ('Wide-Grip Pull-Up', 'Back', 'Vertical pull', ARRAY['Grip outside shoulder width on the bar', 'Pull elbows down and out, chest toward the bar', 'Don''t shrug up, keep the range full']::text[], false),
  ('Neutral-Grip Pull-Up', 'Back', 'Vertical pull', ARRAY['Use parallel handles, palms facing each other', 'Pull elbows straight down to your sides', 'Don''t let elbows drift forward']::text[], false),
  ('Chin-Up', 'Biceps', 'Vertical pull', ARRAY['Underhand grip, shoulder width, start dead hang', 'Pull chin over the bar, elbows tucked', 'Don''t turn it into a half-rep swing']::text[], false),
  ('Assisted Pull-Up', 'Back', 'Vertical pull', ARRAY['Set assistance to just below your max unassisted reps', 'Pull chest toward the bar with full control', 'Don''t rely on the machine to bounce you up']::text[], false),
  ('Band-Assisted Pull-Up', 'Back', 'Vertical pull', ARRAY['Loop the band and place a foot or knee in it', 'Pull through a full range, chest to the bar', 'Don''t let the band do all the work at the top']::text[], false),
  ('Weighted Pull-Up', 'Back', 'Vertical pull', ARRAY['Attach weight securely via belt or vest first', 'Same strict form as bodyweight, full dead hang', 'Don''t shorten the range to handle more load']::text[], false),
  ('Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Grip slightly wider than shoulders, chest tall', 'Pull the bar to your upper chest, elbows down', 'Don''t lean back excessively or use body English']::text[], false),
  ('Wide-Grip Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Grip well outside shoulder width', 'Drive elbows down and back to your sides', 'Don''t yank the bar down with momentum']::text[], false),
  ('Neutral Grip Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Use the neutral-grip handle, palms facing in', 'Pull to upper chest, elbows tracking close to the body', 'Don''t lean back to muscle the weight down']::text[], false),
  ('Close-Grip Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Use the close, narrow handle attachment', 'Pull down to your chest, elbows in front of your torso', 'Don''t lean back too far to compensate']::text[], false),
  ('Single-Arm Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Set up with a single handle attachment', 'Pull elbow down toward your hip, chest tall', 'Don''t rotate your torso to help the pull']::text[], false),
  ('Reverse-Grip Lat Pulldown', 'Back', 'Vertical pull', ARRAY['Underhand grip, hands shoulder width', 'Pull bar to upper chest, elbows close to body', 'Don''t let your biceps take over the pull']::text[], false),
  ('Straight-Arm Pulldown', 'Back', 'Isolation', ARRAY['Stand tall, slight forward lean, arms straight', 'Sweep the bar down to your thighs, lats doing the work', 'Don''t bend your elbows to turn it into a pushdown']::text[], false),
  ('Cable Pullover', 'Back', 'Isolation', ARRAY['Set cable high, step back, slight elbow bend', 'Sweep arms down to your thighs in an arc', 'Don''t bend your elbows more as you pull']::text[], false),
  ('Seated Row', 'Back', 'Horizontal pull', ARRAY['Sit tall, chest up, slight forward lean at the start', 'Pull handles to your torso, elbows close to your sides', 'Don''t round your back or use momentum to yank']::text[], false),
  ('Seated Cable Row', 'Back', 'Horizontal pull', ARRAY['Feet on the platform, knees soft, back neutral', 'Pull to your lower ribs, squeeze your shoulder blades', 'Don''t lean back excessively at the finish']::text[], false),
  ('Wide-Grip Seated Row', 'Back', 'Horizontal pull', ARRAY['Use the wide bar attachment, grip outside shoulders', 'Pull elbows out and back, targeting the upper back', 'Don''t shrug your shoulders to your ears']::text[], false),
  ('Close-Grip Seated Row', 'Back', 'Horizontal pull', ARRAY['Use the V-handle or close grip attachment', 'Pull elbows straight back past your torso', 'Don''t jerk the weight with your lower back']::text[], false),
  ('Single-Arm Cable Row', 'Back', 'Horizontal pull', ARRAY['Split stance for stability, one hand on the handle', 'Pull elbow back, rotate slightly into the row', 'Don''t let your torso swing to add momentum']::text[], false),
  ('Machine Rows', 'Back', 'Horizontal pull', ARRAY['Set chest pad so handles reach at arm''s length', 'Pull elbows back, squeeze shoulder blades together', 'Don''t let the weight stack slam on the return']::text[], false),
  ('Machine High Row', 'Back', 'Horizontal pull', ARRAY['Set handles above shoulder height', 'Pull elbows up and back, targeting upper back', 'Don''t shrug instead of pulling with your back']::text[], false),
  ('Machine Low Row', 'Back', 'Horizontal pull', ARRAY['Set handles at or below chest height', 'Pull elbows down and back to your torso', 'Don''t lean back to help the weight move']::text[], false),
  ('Chest-Supported Row', 'Back', 'Horizontal pull', ARRAY['Chest flat against the pad, arms hang under you', 'Pull elbows back, squeeze shoulder blades together', 'Don''t lift your chest off the pad to cheat the rep']::text[], false),
  ('Chest-Supported DB Row', 'Back', 'Horizontal pull', ARRAY['Lie chest-down on an incline bench with dumbbells hanging', 'Row elbows back and up, squeezing your back', 'Don''t let your head lift off the bench']::text[], false),
  ('Chest-Supported T-Bar Row', 'Back', 'Horizontal pull', ARRAY['Set chest against the pad, grip the handles', 'Pull elbows back, drive through your upper back', 'Don''t use your lower back to heave the weight']::text[], false),
  ('T-Bar Row', 'Back', 'Horizontal pull', ARRAY['Straddle the bar, hinge forward with a flat back', 'Pull the handle to your sternum, elbows close', 'Don''t round your lower back on the pull']::text[], false),
  ('Landmine Row', 'Back', 'Horizontal pull', ARRAY['Straddle or stand beside the landmine bar, hinge forward', 'Pull the end to your ribs, elbow close to your body', 'Don''t let your back round as you pull']::text[], false),
  ('Barbell Row', 'Back', 'Horizontal pull', ARRAY['Hinge to about 45°, flat back, grip just outside hips', 'Pull the bar to your lower ribs', 'Don''t stand up out of the hinge to move the weight']::text[], false),
  ('Bent-Over Barbell Row', 'Back', 'Horizontal pull', ARRAY['Hinge forward, back flat, knees soft', 'Row the bar to your belly button', 'Don''t jerk the bar up with your lower back']::text[], false),
  ('Pendlay Row', 'Back', 'Horizontal pull', ARRAY['Bar starts on the floor each rep, torso near-parallel', 'Explosively row the bar to your lower chest', 'Don''t let your hips rise as you pull']::text[], false),
  ('Yates Row', 'Back', 'Horizontal pull', ARRAY['Torso around 45°, underhand grip on the bar', 'Pull to your lower abdomen, elbows tucked', 'Don''t lean back excessively to finish the rep']::text[], false),
  ('Dumbbell Row', 'Back', 'Horizontal pull', ARRAY['One hand and knee braced on a bench, back flat', 'Pull the dumbbell to your hip, elbow close to your side', 'Don''t rotate your torso to help lift the weight']::text[], false),
  ('Single-Arm Dumbbell Row', 'Back', 'Horizontal pull', ARRAY['Brace on a bench, flat back, arm hanging fully extended', 'Row elbow up and back, squeeze at the top', 'Don''t twist your torso to add momentum']::text[], false),
  ('Meadows Row', 'Back', 'Horizontal pull', ARRAY['Landmine bar to your side, split stance, hinge forward', 'Row the bar up and back toward your hip', 'Don''t rotate your shoulders to swing the weight up']::text[], false),
  ('Seal Row', 'Back', 'Horizontal pull', ARRAY['Lie face-down on an elevated bench, arms hanging', 'Row the bar straight up to your chest', 'Don''t bounce the weight off the floor for momentum']::text[], false),
  ('Inverted Row', 'Back', 'Horizontal pull', ARRAY['Set the bar so your body is a straight line', 'Pull your chest to the bar, squeeze shoulder blades', 'Don''t let your hips sag toward the floor']::text[], false),
  ('TRX Row', 'Back', 'Horizontal pull', ARRAY['Lean back with straps taut, body in a straight line', 'Pull chest to your hands, elbows close to your torso', 'Don''t let your hips drop or pike']::text[], false),
  ('Rack Pulls', 'Back', 'Hinge', ARRAY['Set the bar at knee height in the rack', 'Hinge, grip the bar, drive through your heels to stand', 'Don''t round your lower back to reach the bar']::text[], false),
  ('Block Pulls', 'Back', 'Hinge', ARRAY['Bar rests on blocks just below or at the knee', 'Brace hard and pull the bar up by driving your legs', 'Don''t yank the bar with your back before your legs engage']::text[], false),
  ('Deadlift', 'Back', 'Hinge', ARRAY['Bar over mid-foot, grip just outside your shins', 'Push the floor away, chest and hips rise together', 'Don''t let your hips shoot up before the bar moves']::text[], false),
  ('Barbell Deadlift', 'Back', 'Hinge', ARRAY['Set up with a flat back, bar close to your shins', 'Drive through the floor, bar stays close to your body', 'Don''t round your back to break the bar off the floor']::text[], false),
  ('Trap Bar Deadlift', 'Back', 'Hinge', ARRAY['Stand centered inside the trap bar, chest up', 'Drive through your legs, stand tall at the top', 'Don''t let your hips rise faster than your chest']::text[], false),
  ('Sumo Deadlift', 'Back', 'Hinge', ARRAY['Wide stance, toes turned out, grip inside your knees', 'Push your knees out and drive through the floor', 'Don''t let your knees cave in as you stand']::text[], false),
  ('Deficit Deadlift', 'Back', 'Hinge', ARRAY['Stand on a small platform to increase the range', 'Set up as a normal deadlift, brace before pulling', 'Don''t round your back to compensate for the extra range']::text[], false),
  ('Romanian Deadlift', 'Hamstrings', 'Hinge', ARRAY['Start from the top, soft knees, bar against your thighs', 'Push your hips back, bar slides down your legs', 'Don''t round your lower back or squat the weight down']::text[], false),
  ('Dumbbell Romanian Deadlift', 'Hamstrings', 'Hinge', ARRAY['Hold dumbbells in front of your thighs, soft knees', 'Hinge hips back, feel a hamstring stretch', 'Don''t let the dumbbells drift away from your legs']::text[], false),
  ('Single-Leg Romanian Deadlift', 'Hamstrings', 'Hinge', ARRAY['Balance on one leg, slight bend in the standing knee', 'Hinge forward as your free leg extends back', 'Don''t let your hips rotate open']::text[], false),
  ('Good Morning', 'Hamstrings', 'Hinge', ARRAY['Bar on your back as in a squat, soft knees', 'Hinge forward until you feel a hamstring stretch', 'Don''t round your back or bend excessively at the knees']::text[], false),
  ('Back Extension', 'Back', 'Hinge', ARRAY['Hips on the pad, legs locked under the rollers', 'Lower under control, then extend to a flat line', 'Don''t hyperextend past neutral at the top']::text[], false),
  ('45-Degree Back Extension', 'Back', 'Hinge', ARRAY['Set hip pad at your hip crease, legs secure', 'Lower with a flat back to a stretch, rise to neutral', 'Don''t yank up with your lower back or overextend']::text[], false),
  ('Reverse Hyperextension', 'Back', 'Hinge', ARRAY['Hips on the pad, torso braced, legs hanging', 'Swing legs up in line with your torso', 'Don''t use momentum, control the swing both ways']::text[], false),
  ('Superman Hold', 'Back', 'Isolation', ARRAY['Lie face-down, arms extended overhead', 'Lift chest and legs a few inches off the floor', 'Don''t yank up fast, hold with control']::text[], false),
  ('Overhead Press', 'Shoulders', 'Vertical push', ARRAY['Grip just outside shoulder width, bar at collarbone', 'Press straight up, tucking your head through at the top', 'Don''t lean back excessively to press the bar up']::text[], false),
  ('Standing Barbell Overhead Press', 'Shoulders', 'Vertical push', ARRAY['Brace your core and glutes before pressing', 'Press the bar in a straight line overhead', 'Don''t turn it into a push press without meaning to']::text[], false),
  ('Seated Barbell Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Sit tall against a supported back pad', 'Press straight overhead without arching your lower back', 'Don''t let the bar drift forward in front of your face']::text[], false),
  ('DB Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Dumbbells at shoulder height, palms forward', 'Press up and slightly in until arms are extended', 'Don''t flare your ribs or arch your lower back']::text[], false),
  ('Seated DB Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Sit with back supported, dumbbells at shoulder height', 'Press straight overhead, control the descent', 'Don''t let dumbbells drift forward of your ears']::text[], false),
  ('Single-Arm DB Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Brace your core hard against the offset load', 'Press straight overhead on one side', 'Don''t lean sideways to help drive the weight up']::text[], false),
  ('Arnold Press', 'Shoulders', 'Vertical push', ARRAY['Start with palms facing you, elbows in front', 'Rotate palms out as you press overhead', 'Don''t rush the rotation, keep it smooth']::text[], false),
  ('Machine Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Set seat so handles start at shoulder height', 'Press straight up without shrugging into your ears', 'Don''t let the pin-loaded stack drop fast on the return']::text[], false),
  ('Smith Machine Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Set the bench so the bar starts at shoulder height', 'Press straight up along the fixed bar path', 'Don''t lean forward or back to chase the bar']::text[], false),
  ('Landmine Press', 'Shoulders', 'Vertical push', ARRAY['Hold the landmine end at your shoulder, split stance', 'Press up and slightly forward along its natural arc', 'Don''t let your lower back arch to finish the press']::text[], false),
  ('Single-Arm Landmine Press', 'Shoulders', 'Vertical push', ARRAY['Split stance, brace core against the single-arm load', 'Press the end up and away from your shoulder', 'Don''t let your torso rotate to help the press']::text[], false),
  ('Push Press', 'Shoulders', 'Vertical push', ARRAY['Bar at collarbone, knees soft, elbows slightly forward', 'Dip and drive with your legs, then press overhead', 'Don''t turn it into a slow strict press or a full jump']::text[], false),
  ('Z Press', 'Shoulders', 'Vertical push', ARRAY['Sit on the floor, legs out straight, tall posture', 'Press overhead without using your legs at all', 'Don''t lean back to substitute for shoulder strength']::text[], false),
  ('Pike Push-Up', 'Shoulders', 'Vertical push', ARRAY['Hips high, hands and feet close, forming an inverted V', 'Lower your head toward the floor between your hands', 'Don''t let your hips drop toward a regular push-up']::text[], false),
  ('Handstand Push-Up', 'Shoulders', 'Vertical push', ARRAY['Set up against a wall, hands shoulder width', 'Lower your head toward the floor under control', 'Don''t flare elbows wide or drop your head too fast']::text[], false),
  ('DB Lateral Raises', 'Shoulders', 'Isolation', ARRAY['Slight bend in the elbows, dumbbells at your sides', 'Raise out to shoulder height, leading with your elbows', 'Don''t shrug your traps or swing the weight up']::text[], false),
  ('Cable Lateral Raises', 'Shoulders', 'Isolation', ARRAY['Cable at the lowest setting, stand side-on to the stack', 'Raise your arm out to shoulder height', 'Don''t lean away from the cable to cheat the raise']::text[], false),
  ('Machine Lateral Raise', 'Shoulders', 'Isolation', ARRAY['Set seat so pads sit at your upper arms', 'Raise arms out to the sides to shoulder height', 'Don''t shrug your shoulders up as you lift']::text[], false),
  ('Lean-Away Lateral Raise', 'Shoulders', 'Isolation', ARRAY['Hold a post or machine frame, lean your torso away', 'Raise the dumbbell out to the side against gravity', 'Don''t use momentum, keep the lean stable throughout']::text[], false),
  ('Front Raise', 'Shoulders', 'Isolation', ARRAY['Dumbbells in front of your thighs, slight elbow bend', 'Raise straight out in front to shoulder height', 'Don''t swing or use your lower back to heave it up']::text[], false),
  ('Plate Front Raise', 'Shoulders', 'Isolation', ARRAY['Hold a plate with both hands at the rim', 'Raise it in front to shoulder height', 'Don''t lean back to generate momentum']::text[], false),
  ('Cable Front Raise', 'Shoulders', 'Isolation', ARRAY['Cable behind you at the low setting', 'Raise your arm forward to shoulder height', 'Don''t rock your torso to help lift the weight']::text[], false),
  ('Rear Delt Fly', 'Shoulders', 'Isolation', ARRAY['Hinge forward, dumbbells hanging, slight elbow bend', 'Raise arms out to the sides, squeezing your rear delts', 'Don''t turn it into an upright row by bending elbows more']::text[], false),
  ('Reverse Pec Deck', 'Shoulders', 'Isolation', ARRAY['Face into the machine, chest against the pad', 'Pull handles out and back, squeezing rear delts', 'Don''t shrug your shoulders toward your ears']::text[], false),
  ('Cable Rear Delt Fly', 'Shoulders', 'Isolation', ARRAY['Cross cables in front, slight forward lean', 'Pull arms out and back in a wide arc', 'Don''t bend your elbows more to help the pull']::text[], false),
  ('Face Pull', 'Shoulders', 'Horizontal pull', ARRAY['Rope at upper-chest to head height, elbows high', 'Pull toward your face, rotating hands back', 'Don''t let your elbows drop below shoulder height']::text[], false),
  ('Upright Row', 'Shoulders', 'Isolation', ARRAY['Grip just inside shoulder width, bar in front of thighs', 'Pull elbows up and out to about shoulder height', 'Don''t pull the bar higher than shoulder height']::text[], false),
  ('Cable Upright Row', 'Shoulders', 'Isolation', ARRAY['Cable at the low setting, grip shoulder width', 'Pull elbows up and out, bar close to your body', 'Don''t shrug instead of leading with your elbows']::text[], false),
  ('Barbell Shrug', 'Shoulders', 'Isolation', ARRAY['Hold the bar at arm''s length in front of your thighs', 'Shrug straight up toward your ears, pause briefly', 'Don''t roll your shoulders, keep the motion straight up and down']::text[], false),
  ('Dumbbell Shrug', 'Shoulders', 'Isolation', ARRAY['Dumbbells at your sides, arms relaxed and straight', 'Shrug straight up, squeezing your traps at the top', 'Don''t bend your elbows to help lift the weight']::text[], false),
  ('Smith Machine Shrug', 'Shoulders', 'Isolation', ARRAY['Stand under the bar, grip just outside your hips', 'Shrug straight up along the fixed bar path', 'Don''t lean back to add momentum to the shrug']::text[], false),
  ('Trap 3 Raise', 'Shoulders', 'Isolation', ARRAY['Lie face-down or hinge forward, arm at your side', 'Raise your arm at about a 30° angle from your body', 'Don''t raise higher than shoulder height or swing the weight']::text[], false),
  ('Y Raise', 'Shoulders', 'Isolation', ARRAY['Hinge forward or lie face-down on an incline bench', 'Raise arms overhead in a Y shape, thumbs up', 'Don''t shrug your shoulders up instead of raising your arms']::text[], false),
  ('T Raise', 'Shoulders', 'Isolation', ARRAY['Hinge forward or lie face-down, arms hanging straight down', 'Raise arms straight out to the sides forming a T', 'Don''t use momentum to swing the weights up']::text[], false),
  ('Wall Slide', 'Shoulders', 'Isolation', ARRAY['Stand with back, head, and arms against a wall', 'Slide arms up overhead keeping contact with the wall', 'Don''t let your lower back arch off the wall']::text[], false),
  ('Scaption Raise', 'Shoulders', 'Isolation', ARRAY['Hold dumbbells at your sides, thumbs slightly up', 'Raise arms at a 30° angle in front of your body', 'Don''t raise past shoulder height or shrug up']::text[], false),
  ('External Rotation Cable', 'Shoulders', 'Isolation', ARRAY['Elbow pinned to your side at 90°, cable across your body', 'Rotate your forearm outward, keeping the elbow fixed', 'Don''t let your elbow drift away from your side']::text[], false),
  ('Banded External Rotation', 'Shoulders', 'Isolation', ARRAY['Elbow tucked to your side, band anchored across your body', 'Rotate your forearm out slowly, elbow staying fixed', 'Don''t use your shoulder or torso to help the rotation']::text[], false),
  ('Internal Rotation Cable', 'Shoulders', 'Isolation', ARRAY['Elbow pinned to your side at 90°, cable out to the side', 'Rotate your forearm in across your stomach', 'Don''t let your elbow drift forward or back']::text[], false),
  ('Bicep Curl', 'Biceps', 'Isolation', ARRAY['Elbows pinned to your sides throughout', 'Curl the weight up without swinging your torso', 'Don''t let your elbows drift forward as you curl']::text[], false),
  ('Barbell Curl', 'Biceps', 'Isolation', ARRAY['Grip shoulder width, elbows tucked to your sides', 'Curl the bar up, squeezing at the top', 'Don''t lean back or swing the bar up with momentum']::text[], false),
  ('EZ-Bar Curl', 'Biceps', 'Isolation', ARRAY['Use the angled grips to keep wrists comfortable', 'Curl up with elbows fixed at your sides', 'Don''t let your elbows travel forward during the curl']::text[], false),
  ('Dumbbell Curl', 'Biceps', 'Isolation', ARRAY['Arms fully extended, palms facing forward', 'Curl up, squeezing your biceps at the top', 'Don''t swing the dumbbells up using your shoulders']::text[], false),
  ('Alternating DB Curl', 'Biceps', 'Isolation', ARRAY['Stand tall, one dumbbell curls while the other stays extended', 'Curl each arm fully, rotating palm up as you go', 'Don''t rock your torso side to side for momentum']::text[], false),
  ('Incline DB Curl', 'Biceps', 'Isolation', ARRAY['Sit back on an incline bench, arms hanging straight down', 'Curl up without letting elbows drift forward', 'Don''t let the bench angle turn into shoulder swing']::text[], false),
  ('Hammer Curl', 'Biceps', 'Isolation', ARRAY['Palms face each other throughout the movement', 'Curl straight up, keeping wrists neutral', 'Don''t rotate your wrists into a regular curl']::text[], false),
  ('Cross-Body Hammer Curl', 'Biceps', 'Isolation', ARRAY['Neutral grip, dumbbell at your side', 'Curl across your body toward the opposite shoulder', 'Don''t let your elbow drift away from your torso']::text[], false),
  ('Cable Curl', 'Biceps', 'Isolation', ARRAY['Stand tall, cable at the low pulley', 'Curl up with elbows fixed at your sides', 'Don''t lean back to help move the weight']::text[], false),
  ('Rope Curl', 'Biceps', 'Isolation', ARRAY['Grip the rope ends, elbows tucked in', 'Curl up and spread the rope apart slightly at the top', 'Don''t let your elbows flare out during the curl']::text[], false),
  ('Bayesian Cable Curl', 'Biceps', 'Isolation', ARRAY['Cable set low, stand facing away with arm behind your torso', 'Curl forward, keeping the stretch at the bottom', 'Don''t let your elbow drift forward through the rep']::text[], false),
  ('Preacher Curl', 'Biceps', 'Isolation', ARRAY['Upper arms flat against the preacher pad', 'Curl up without lifting your elbows off the pad', 'Don''t let the weight drop fast at the bottom']::text[], false),
  ('Machine Curl', 'Biceps', 'Isolation', ARRAY['Set seat so upper arms rest on the pad', 'Curl through a full range, squeeze at the top', 'Don''t let the weight stack slam on the way down']::text[], false),
  ('Spider Curl', 'Biceps', 'Isolation', ARRAY['Chest against an incline bench, arms hanging straight down', 'Curl up without letting elbows move backward', 'Don''t rush the eccentric, control it fully']::text[], false),
  ('Concentration Curl', 'Biceps', 'Isolation', ARRAY['Elbow braced against your inner thigh, seated', 'Curl up in a slow, controlled arc', 'Don''t let your elbow drift off your thigh']::text[], false),
  ('Reverse Curl', 'Biceps', 'Isolation', ARRAY['Overhand grip, shoulder width on the bar', 'Curl up keeping wrists straight and firm', 'Don''t let your wrists bend or the bar roll in your grip']::text[], false),
  ('Zottman Curl', 'Biceps', 'Isolation', ARRAY['Curl up with palms facing forward', 'Rotate palms down at the top, lower slowly', 'Don''t skip the slow, controlled rotation on the way down']::text[], false),
  ('Drag Curl', 'Biceps', 'Isolation', ARRAY['Bar close to your body, elbows drawn back', 'Drag the bar up your torso, elbows moving behind you', 'Don''t let the bar swing away from your body']::text[], false),
  ('High Cable Curl', 'Biceps', 'Isolation', ARRAY['Cables set high, arms out to the sides', 'Curl hands toward your ears, squeezing your biceps peak', 'Don''t let your elbows drop during the curl']::text[], false),
  ('Single-Arm Cable Curl', 'Biceps', 'Isolation', ARRAY['Stand side-on to the low pulley, elbow at your side', 'Curl up, keeping your elbow pinned in place', 'Don''t rotate your torso to assist the curl']::text[], false),
  ('Tricep Pushdown', 'Triceps', 'Isolation', ARRAY['Elbows pinned to your sides, cable at chest height', 'Push down until arms are fully extended', 'Don''t let your elbows flare out or drift forward']::text[], false),
  ('Rope Tricep Pushdown', 'Triceps', 'Isolation', ARRAY['Grip the rope ends, elbows tucked in', 'Push down and spread the rope apart at the bottom', 'Don''t let your elbows move away from your body']::text[], false),
  ('Straight-Bar Pushdown', 'Triceps', 'Isolation', ARRAY['Overhand grip, shoulder width, elbows at your sides', 'Push the bar down to full extension', 'Don''t lean over the bar to add body weight']::text[], false),
  ('V-Bar Pushdown', 'Triceps', 'Isolation', ARRAY['Grip the angled V-bar, elbows tucked', 'Push down through full extension, squeeze at the bottom', 'Don''t let your elbows drift forward as you push']::text[], false),
  ('Single-Arm Pushdown', 'Triceps', 'Isolation', ARRAY['Stand tall, elbow pinned to your side', 'Push down to full extension on one arm', 'Don''t twist your torso to help the push']::text[], false),
  ('Overhead Cable Tricep Extension', 'Triceps', 'Isolation', ARRAY['Face away from the stack, rope overhead, elbows in', 'Extend forward and up without moving your upper arms', 'Don''t let your elbows flare out to the sides']::text[], false),
  ('EZ Tricep Extension', 'Triceps', 'Isolation', ARRAY['Lie or stand with the EZ-bar overhead, elbows in', 'Lower behind your head, then extend back up', 'Don''t let your elbows flare out as you lower']::text[], false),
  ('Skull Crusher', 'Triceps', 'Isolation', ARRAY['Lie on a bench, bar over your forehead, elbows in', 'Lower the bar toward your forehead, elbows stay fixed', 'Don''t let your elbows flare or drift toward your face']::text[], false),
  ('Incline Skull Crusher', 'Triceps', 'Isolation', ARRAY['Lie on an incline bench, arms extended over your face', 'Lower toward your forehead, keeping elbows pointed up', 'Don''t let elbows travel backward as you lower']::text[], false),
  ('Dips', 'Triceps', 'Vertical push', ARRAY['Torso upright, elbows tracking back close to your body', 'Lower until your upper arms are about parallel to the floor', 'Don''t lean forward too much or you''ll shift to chest']::text[], false),
  ('Assisted Dips', 'Triceps', 'Vertical push', ARRAY['Set assistance so you control the full range', 'Torso upright, lower to elbows near parallel', 'Don''t let the machine bounce you out of the bottom']::text[], false),
  ('Bench Dips', 'Triceps', 'Vertical push', ARRAY['Hands on a bench behind you, legs extended out', 'Lower straight down, elbows pointing behind you', 'Don''t let your shoulders roll forward or shrug up']::text[], false),
  ('Machine Tricep Extension', 'Triceps', 'Isolation', ARRAY['Set seat so elbows align with the machine''s pivot', 'Extend through a full range, squeeze at the bottom', 'Don''t let your elbows lift off the pad']::text[], false),
  ('Dumbbell Overhead Tricep Extension', 'Triceps', 'Isolation', ARRAY['Hold one dumbbell with both hands overhead, elbows in', 'Lower behind your head, elbows staying close together', 'Don''t let your elbows flare out wide']::text[], false),
  ('Single-Arm DB Tricep Extension', 'Triceps', 'Isolation', ARRAY['Dumbbell overhead in one hand, elbow pointing up', 'Lower behind your head, elbow staying fixed', 'Don''t let your elbow drift out to the side']::text[], false),
  ('Cable Kickback', 'Triceps', 'Isolation', ARRAY['Hinge forward, upper arm parallel to the floor', 'Extend your forearm straight back, squeeze at the top', 'Don''t swing your upper arm to help the extension']::text[], false),
  ('Dumbbell Kickback', 'Triceps', 'Isolation', ARRAY['Hinge forward, upper arm held parallel to your torso', 'Extend the dumbbell straight back to full lockout', 'Don''t let your upper arm drop as you extend']::text[], false),
  ('JM Press', 'Triceps', 'Isolation', ARRAY['Bar path lands between a skull crusher and close-grip press', 'Lower to your upper chest/chin, elbows tracking forward slightly', 'Don''t let the bar drift toward your throat']::text[], false),
  ('Squat', 'Quads', 'Squat', ARRAY['Feet shoulder width, bar/weight braced, chest tall', 'Break at the hips and knees together, sit down and back', 'Don''t let your knees cave in or your heels lift']::text[], false),
  ('Back Squat', 'Quads', 'Squat', ARRAY['Bar across your upper back, braced tight', 'Squat to at least parallel, knees tracking over toes', 'Don''t let your chest collapse forward on the way up']::text[], false),
  ('High-Bar Squat', 'Quads', 'Squat', ARRAY['Bar sits on your traps, torso stays more upright', 'Squat down with knees traveling forward over your toes', 'Don''t let your heels lift off the floor']::text[], false),
  ('Low-Bar Squat', 'Quads', 'Squat', ARRAY['Bar sits lower across your rear delts, more forward lean', 'Hinge slightly more, drive knees out as you descend', 'Don''t round your upper back under the bar']::text[], false),
  ('Front Squat', 'Quads', 'Squat', ARRAY['Bar rests on your front delts, elbows high', 'Squat down keeping your torso as upright as possible', 'Don''t let your elbows drop, or the bar will roll forward']::text[], false),
  ('Goblet Squat', 'Quads', 'Squat', ARRAY['Hold a dumbbell or kettlebell at your chest', 'Squat down between your knees, chest tall', 'Don''t let the weight pull your chest forward and down']::text[], false),
  ('Box Squat', 'Quads', 'Squat', ARRAY['Set a box at or just below parallel behind you', 'Sit back onto the box under control, then drive up', 'Don''t relax or bounce off the box, stay tight']::text[], false),
  ('Pause Squat', 'Quads', 'Squat', ARRAY['Set up and descend as a normal squat', 'Pause motionless at the bottom for 1-2 seconds', 'Don''t bounce out of the pause using stretch reflex']::text[], false),
  ('Tempo Squat', 'Quads', 'Squat', ARRAY['Set up as a standard squat', 'Lower for the prescribed slow count, no rushing', 'Don''t lose tightness or let your knees cave during the descent']::text[], false),
  ('Smith Machine Squat', 'Quads', 'Squat', ARRAY['Feet slightly forward of the fixed bar path', 'Squat down along the fixed vertical rail', 'Don''t let your knees track wildly forward to compensate']::text[], false),
  ('Hack Squat', 'Quads', 'Squat', ARRAY['Shoulders and back flat against the pads, feet mid-platform', 'Squat down through a full range under control', 'Don''t let your lower back round off the pad']::text[], false),
  ('V-Squat', 'Quads', 'Squat', ARRAY['Position yourself in the V-shaped carriage, back flat', 'Squat down along the machine''s guided path', 'Don''t let your knees collapse inward during the descent']::text[], false),
  ('Pendulum Squat', 'Quads', 'Squat', ARRAY['Shoulders under the pads, feet set on the platform', 'Squat down following the pendulum''s arc', 'Don''t let your heels lift as you descend']::text[], false),
  ('Belt Squat', 'Quads', 'Squat', ARRAY['Attach the belt at your hips, stand on the platform', 'Squat down, letting the load hang below you', 'Don''t round your back since the load pulls straight down']::text[], false),
  ('Safety Bar Squat', 'Quads', 'Squat', ARRAY['Bar yoke rests on your traps, grip the front handles', 'Squat down keeping your torso upright against the forward pull', 'Don''t let the bar''s forward bias pull you into a fold']::text[], false),
  ('Landmine Squat', 'Quads', 'Squat', ARRAY['Hold the landmine end at your chest with both hands', 'Squat down keeping your torso as upright as possible', 'Don''t let the weight pull your chest down and forward']::text[], false),
  ('Leg Press', 'Quads', 'Squat', ARRAY['Feet shoulder width on the platform, back flat on the pad', 'Lower until knees reach about 90°, press back up', 'Don''t let your lower back round off the pad at the bottom']::text[], false),
  ('Single-Leg Leg Press', 'Quads', 'Squat', ARRAY['One foot centered on the platform, other leg out of the way', 'Lower under control to about 90° at the knee', 'Don''t let your knee cave inward as you press']::text[], false),
  ('Narrow-Stance Leg Press', 'Quads', 'Squat', ARRAY['Feet close together, centered low on the platform', 'Lower under control, knees tracking over your toes', 'Don''t let your knees knock together on the way down']::text[], false),
  ('Wide-Stance Leg Press', 'Quads', 'Squat', ARRAY['Feet wide, turned slightly out, high on the platform', 'Lower under control, knees tracking over your toes', 'Don''t let your lower back round at the bottom']::text[], false),
  ('Leg Extension', 'Quads', 'Isolation', ARRAY['Set the pad against your shins, back against the seat', 'Extend your legs to full lockout, squeeze your quads', 'Don''t use momentum or swing the weight up']::text[], false),
  ('Single-Leg Extension', 'Quads', 'Isolation', ARRAY['Set the pad against one shin, other foot on the floor', 'Extend fully, squeezing at the top', 'Don''t let the working leg twist outward as you extend']::text[], false),
  ('Sissy Squat', 'Quads', 'Squat', ARRAY['Hold something for balance, rise onto your toes', 'Lean back and bend your knees, keeping hips extended', 'Don''t bend at the hips, this is a knee-dominant movement']::text[], false),
  ('Spanish Squat', 'Quads', 'Squat', ARRAY['Loop a band around a rack and behind your knees', 'Sit back into the band, torso staying upright', 'Don''t let your knees travel forward past your toes']::text[], false),
  ('Wall Sit', 'Quads', 'Squat', ARRAY['Back flat against the wall, thighs at about 90°', 'Hold the position, breathing steadily', 'Don''t let your knees creep forward past your ankles']::text[], false),
  ('Lunge', 'Quads', 'Lunge', ARRAY['Step forward, torso upright, core braced', 'Lower until both knees reach about 90°', 'Don''t let your front knee cave inward or shoot past your toes']::text[], false),
  ('Walking Lunge', 'Quads', 'Lunge', ARRAY['Step forward into a lunge, torso tall', 'Drive through the front heel to step into the next lunge', 'Don''t let your back knee slam into the floor']::text[], false),
  ('Reverse Lunge', 'Quads', 'Lunge', ARRAY['Step backward into a lunge, torso upright', 'Lower your back knee toward the floor under control', 'Don''t let your front knee travel past your toes']::text[], false),
  ('Forward Lunge', 'Quads', 'Lunge', ARRAY['Step forward with control, torso tall', 'Lower until both knees are near 90°', 'Don''t let your front knee drift inward']::text[], false),
  ('Deficit Reverse Lunge', 'Quads', 'Lunge', ARRAY['Stand on a small platform for extra range', 'Step back and lower your knee below the platform level', 'Don''t lose balance rushing the step back']::text[], false),
  ('Dumbbell Lunge', 'Quads', 'Lunge', ARRAY['Dumbbells at your sides, torso tall', 'Step and lower until both knees reach about 90°', 'Don''t let the weights pull your torso forward']::text[], false),
  ('Barbell Lunge', 'Quads', 'Lunge', ARRAY['Bar across your upper back, braced core', 'Step into the lunge, lower under control', 'Don''t let the bar pull you off balance']::text[], false),
  ('Bulgarian Split Squat', 'Quads', 'Lunge', ARRAY['Rear foot elevated on a bench, front foot forward', 'Lower straight down until your front thigh is near parallel', 'Don''t let your front knee cave in or shoot past your toes']::text[], false),
  ('Split Squat', 'Quads', 'Lunge', ARRAY['Split stance, both feet on the floor, torso upright', 'Lower straight down, back knee toward the floor', 'Don''t let your front heel lift off the floor']::text[], false),
  ('Smith Machine Split Squat', 'Quads', 'Lunge', ARRAY['Split stance under the fixed bar, feet set for balance', 'Lower straight down along the fixed bar path', 'Don''t let your front knee travel past your toes']::text[], false),
  ('Step-Up', 'Quads', 'Lunge', ARRAY['Full foot on the box, torso tall', 'Drive through the top foot to stand on the box', 'Don''t push off your bottom leg to help you up']::text[], false),
  ('Box Step-Up', 'Quads', 'Lunge', ARRAY['Choose a box height you can control with one leg', 'Stand up onto the box, driving through the heel', 'Don''t bounce or push off the trailing leg']::text[], false),
  ('Lateral Step-Up', 'Quads', 'Lunge', ARRAY['Stand sideways next to the box, foot flat on top', 'Drive through the top leg to stand up sideways', 'Don''t let your standing knee cave inward']::text[], false),
  ('Cossack Squat', 'Quads', 'Lunge', ARRAY['Wide stance, shift your weight to one bent leg', 'Sink your hips down and back over that leg', 'Don''t let the bent knee cave inward']::text[], false),
  ('Cyclist Squat', 'Quads', 'Squat', ARRAY['Heels elevated on plates, narrow stance', 'Squat down keeping your torso very upright', 'Don''t let your heels come off the plates']::text[], false),
  ('Cable Squat', 'Quads', 'Squat', ARRAY['Cable low behind you, handle held at your chest', 'Squat down against the resistance, chest tall', 'Don''t let the cable pull you off balance']::text[], false),
  ('Lying Leg Curl', 'Hamstrings', 'Isolation', ARRAY['Lie face-down, pad against your ankles, hips pressed into the bench', 'Curl your heels toward your glutes', 'Don''t let your hips lift off the bench']::text[], false),
  ('Seated Leg Curl', 'Hamstrings', 'Isolation', ARRAY['Sit back, pad against your lower shins, back against the seat', 'Curl your heels down and under the seat', 'Don''t let your hips rise off the seat']::text[], false),
  ('Standing Leg Curl', 'Hamstrings', 'Isolation', ARRAY['Pad against one ankle, standing tall, slight hip hinge', 'Curl your heel up toward your glute', 'Don''t swing your hips to generate momentum']::text[], false),
  ('Nordic Hamstring Curl', 'Hamstrings', 'Isolation', ARRAY['Ankles anchored, kneel tall, hips locked straight', 'Lower your torso forward as slowly as you can control', 'Don''t bend at the hips, this is a knee-only lower']::text[], false),
  ('Glute-Ham Raise', 'Hamstrings', 'Isolation', ARRAY['Feet secured in the GHR footplate, hips on the pad', 'Lower your torso forward, then curl back up using your hamstrings', 'Don''t let your hips fold, keep them extended throughout']::text[], false),
  ('Hip Thrust', 'Glutes', 'Hinge', ARRAY['Upper back against a bench, bar over your hips', 'Drive your hips up until your torso is level with your knees', 'Don''t hyperextend your lower back at the top']::text[], false),
  ('Barbell Hip Thrust', 'Glutes', 'Hinge', ARRAY['Pad the bar, upper back on the bench, feet flat', 'Drive through your heels, squeeze your glutes at the top', 'Don''t push through your toes or arch your lower back']::text[], false),
  ('Smith Machine Hip Thrust', 'Glutes', 'Hinge', ARRAY['Set up under the bar with your upper back on the bench', 'Drive hips up along the fixed vertical path', 'Don''t let your knees cave in as you press up']::text[], false),
  ('Single-Leg Hip Thrust', 'Glutes', 'Hinge', ARRAY['Upper back on the bench, one foot planted, other leg extended', 'Drive through the planted heel, hips rising level', 'Don''t let your hips rotate open on the working side']::text[], false),
  ('Glute Bridge', 'Glutes', 'Hinge', ARRAY['Lie on your back, knees bent, feet flat near your glutes', 'Drive your hips up, squeezing your glutes at the top', 'Don''t arch your lower back to gain height']::text[], false),
  ('Barbell Glute Bridge', 'Glutes', 'Hinge', ARRAY['Bar padded across your hips, shoulders on the floor', 'Drive hips up, squeeze glutes hard at the top', 'Don''t let the bar roll or your lower back overextend']::text[], false),
  ('Single-Leg Glute Bridge', 'Glutes', 'Hinge', ARRAY['Lie on your back, one foot planted, other leg extended', 'Drive through the planted heel, hips rising evenly', 'Don''t let your hips tilt toward the lifted leg']::text[], false),
  ('Cable Pull-Through', 'Glutes', 'Hinge', ARRAY['Cable between your legs, hinge forward, soft knees', 'Drive your hips forward to stand tall, squeezing glutes', 'Don''t round your back or squat the weight through']::text[], false),
  ('Kettlebell Swing', 'Glutes', 'Hinge', ARRAY['Hinge back, kettlebell swings between your legs', 'Snap your hips forward to drive the bell to chest height', 'Don''t squat the movement or lift with your arms']::text[], false),
  ('Dumbbell RDL', 'Hamstrings', 'Hinge', ARRAY['Dumbbells in front of your thighs, soft knees', 'Hinge your hips back, weights sliding down your legs', 'Don''t round your lower back or let the weights drift away']::text[], false),
  ('Barbell RDL', 'Hamstrings', 'Hinge', ARRAY['Bar against your thighs, soft knees, flat back', 'Hinge hips back until you feel a hamstring stretch', 'Don''t let the bar drift away from your legs']::text[], false),
  ('Stiff-Leg Deadlift', 'Hamstrings', 'Hinge', ARRAY['Legs nearly straight, very slight knee bend', 'Hinge at the hips, lowering the bar down your legs', 'Don''t round your back to reach further down']::text[], false),
  ('Single-Leg Deadlift', 'Hamstrings', 'Hinge', ARRAY['Balance on one leg, soft bend in the standing knee', 'Hinge forward as your free leg extends behind you', 'Don''t let your hips rotate open']::text[], false),
  ('B-Stance RDL', 'Hamstrings', 'Hinge', ARRAY['Rear foot staggered back on its toes for balance', 'Hinge hips back, weight mainly on the front leg', 'Don''t let the rear foot take over the movement']::text[], false),
  ('Hip Abduction Machine', 'Glutes', 'Isolation', ARRAY['Sit tall, pads against your outer thighs', 'Push your legs apart against the resistance', 'Don''t lean forward or use momentum to open your legs']::text[], false),
  ('Cable Hip Abduction', 'Glutes', 'Isolation', ARRAY['Cuff on your ankle, cable anchored at the opposite low point', 'Lift your leg out to the side against the cable', 'Don''t lean your torso to help swing the leg']::text[], false),
  ('Cable Hip Adduction', 'Glutes', 'Isolation', ARRAY['Cuff on your ankle, cable anchored to the same-side low point', 'Pull your leg across your body against the cable', 'Don''t rotate your hips to assist the movement']::text[], false),
  ('Banded Lateral Walk', 'Glutes', 'Isolation', ARRAY['Band around your ankles or above your knees, slight squat', 'Step sideways keeping tension on the band', 'Don''t let your knees cave in or stand fully upright']::text[], false),
  ('Monster Walk', 'Glutes', 'Isolation', ARRAY['Band around your ankles, knees slightly bent', 'Step forward diagonally, maintaining band tension', 'Don''t let your torso bounce or knees collapse inward']::text[], false),
  ('Clamshell', 'Glutes', 'Isolation', ARRAY['Lie on your side, knees bent, hips stacked', 'Open your top knee like a clamshell, keeping feet together', 'Don''t roll your hips backward to fake the range']::text[], false),
  ('Frog Pump', 'Glutes', 'Hinge', ARRAY['Lie on your back, soles of your feet together, knees out', 'Drive your hips up, squeezing your glutes hard', 'Don''t let your lower back do the work instead of your glutes']::text[], false),
  ('Kickback Machine', 'Glutes', 'Isolation', ARRAY['Foot on the platform, torso braced against the pad', 'Kick your leg back and up, squeezing your glute', 'Don''t hyperextend your lower back to add range']::text[], false),
  ('Cable Glute Kickback', 'Glutes', 'Isolation', ARRAY['Cuff on your ankle, cable anchored low behind you', 'Kick your leg back and up against the cable', 'Don''t arch your lower back to gain height']::text[], false),
  ('Donkey Kick', 'Glutes', 'Isolation', ARRAY['On all fours, knee bent at 90°', 'Drive your foot toward the ceiling, squeezing your glute', 'Don''t arch your lower back to lift higher']::text[], false),
  ('Reverse Lunge to Knee Drive', 'Glutes', 'Lunge', ARRAY['Step back into a reverse lunge, torso tall', 'Drive through the front heel, bringing the back knee up high', 'Don''t lose balance rushing the knee drive']::text[], false),
  ('Standing Calf Raise', 'Calves', 'Isolation', ARRAY['Balls of your feet on the platform, full stretch at the bottom', 'Rise up as high as possible onto your toes', 'Don''t bounce, control both the rise and the lower']::text[], false),
  ('Seated Calf Raise', 'Calves', 'Isolation', ARRAY['Pad across your lower thighs, balls of feet on the platform', 'Press up through your toes to full contraction', 'Don''t rush the stretch at the bottom']::text[], false),
  ('Leg Press Calf Raise', 'Calves', 'Isolation', ARRAY['Balls of your feet on the lower edge of the platform', 'Press through your toes, extending your ankles fully', 'Don''t let your knees bend to help the press']::text[], false),
  ('Smith Machine Calf Raise', 'Calves', 'Isolation', ARRAY['Balls of feet on a block under the bar', 'Rise up onto your toes through the fixed path', 'Don''t let your knees bend during the raise']::text[], false),
  ('Single-Leg Calf Raise', 'Calves', 'Isolation', ARRAY['Balance on one foot, ball of foot on a raised edge', 'Rise up as high as possible on that one foot', 'Don''t use the other leg to help push you up']::text[], false),
  ('Donkey Calf Raise', 'Calves', 'Isolation', ARRAY['Hinge forward at the hips, balls of feet on a platform', 'Rise up onto your toes through a full stretch', 'Don''t rush the stretch phase at the bottom']::text[], false),
  ('Tibialis Raise', 'Calves', 'Isolation', ARRAY['Lean back against a wall or use a tib bar, heels planted', 'Lift your toes up toward your shins', 'Don''t let your heels lift off the floor']::text[], false),
  ('Toe Raise', 'Calves', 'Isolation', ARRAY['Stand tall, weight on your heels', 'Lift the front of your feet up off the floor', 'Don''t rock backward to gain extra height']::text[], false),
  ('Farmer Walk on Toes', 'Calves', 'Carry', ARRAY['Grip weights at your sides, rise onto your toes', 'Walk forward staying up on the balls of your feet', 'Don''t let your heels touch down between steps']::text[], false),
  ('Jump Rope Calf Bounce', 'Calves', 'Isolation', ARRAY['Stay light on the balls of your feet', 'Use small, quick ankle bounces to turn the rope', 'Don''t land flat-footed or jump too high']::text[], false),
  ('Plank', 'Core', 'Isolation', ARRAY['Elbows under shoulders, body in a straight line', 'Brace your abs and squeeze your glutes', 'Don''t let your hips sag or pike up']::text[], false),
  ('Side Plank', 'Core', 'Isolation', ARRAY['Elbow under your shoulder, body in a straight line sideways', 'Lift your hips so your body forms one line', 'Don''t let your hips drop toward the floor']::text[], false),
  ('Weighted Plank', 'Core', 'Isolation', ARRAY['Have a plate placed securely on your upper back', 'Hold a straight line from head to heels', 'Don''t let the added weight cause your hips to sag']::text[], false),
  ('RKC Plank', 'Core', 'Isolation', ARRAY['Forearms down, actively pull elbows toward your toes', 'Squeeze glutes and quads as hard as possible', 'Don''t relax into a normal easy plank hold']::text[], false),
  ('Hollow Hold', 'Core', 'Isolation', ARRAY['Lie on your back, press your lower back into the floor', 'Lift shoulders and legs slightly, arms overhead', 'Don''t let your lower back arch off the floor']::text[], false),
  ('Hollow Rock', 'Core', 'Isolation', ARRAY['Hold the hollow body position, arms overhead', 'Rock gently back and forth keeping the shape rigid', 'Don''t let your lower back lift off the floor as you rock']::text[], false),
  ('Dead Bug', 'Core', 'Rotation/Anti-rotation', ARRAY['Lie on your back, arms up, knees bent at 90°', 'Extend opposite arm and leg while pressing your back flat', 'Don''t let your lower back arch off the floor']::text[], false),
  ('Bird Dog', 'Core', 'Rotation/Anti-rotation', ARRAY['On all fours, spine neutral', 'Extend opposite arm and leg out straight', 'Don''t let your hips or shoulders rotate open']::text[], false),
  ('McGill Curl Up', 'Core', 'Isolation', ARRAY['Lie down, one knee bent, hands under your lower back', 'Lift your head and shoulders slightly off the floor', 'Don''t flex through your lower back, keep it neutral']::text[], false),
  ('Curl Up', 'Core', 'Isolation', ARRAY['Lie on your back, knees bent, hands at your sides', 'Curl your shoulders up off the floor', 'Don''t pull on your neck with your hands']::text[], false),
  ('Crunch', 'Core', 'Isolation', ARRAY['Knees bent, hands lightly supporting your head', 'Curl your shoulder blades up off the floor', 'Don''t yank your neck forward with your hands']::text[], false),
  ('Machine Crunch', 'Core', 'Isolation', ARRAY['Adjust the pad to sit against your upper chest', 'Curl your torso forward, squeezing your abs', 'Don''t use your arms to pull the weight down']::text[], false),
  ('Cable Crunch', 'Core', 'Isolation', ARRAY['Kneel below the pulley, rope at the back of your neck', 'Curl your torso down, rounding your spine toward your hips', 'Don''t pull with your arms, let your abs do the work']::text[], false),
  ('Decline Sit-Up', 'Core', 'Isolation', ARRAY['Feet secured on a decline bench, hands across your chest', 'Curl your torso all the way up', 'Don''t yank yourself up using momentum']::text[], false),
  ('Sit-Up', 'Core', 'Isolation', ARRAY['Knees bent, feet anchored or flat on the floor', 'Curl your torso all the way up to your thighs', 'Don''t pull yourself up by your neck or use momentum']::text[], false),
  ('Reverse Crunch', 'Core', 'Isolation', ARRAY['Lie on your back, knees bent toward your chest', 'Curl your hips up off the floor toward your ribs', 'Don''t swing your legs to generate momentum']::text[], false),
  ('Hanging Knee Raise', 'Core', 'Isolation', ARRAY['Hang from a bar, shoulders engaged, slight lean back', 'Raise your knees up toward your chest', 'Don''t swing or use momentum from your hips']::text[], false),
  ('Hanging Leg Raise', 'Core', 'Isolation', ARRAY['Hang from a bar, legs straight, shoulders engaged', 'Raise your straight legs up to at least hip height', 'Don''t let your legs swing forward and back']::text[], false),
  ('Captain''s Chair Knee Raise', 'Core', 'Isolation', ARRAY['Forearms on the pads, back against the support', 'Raise your knees up toward your chest', 'Don''t lean back and swing to generate momentum']::text[], false),
  ('Toes to Bar', 'Core', 'Isolation', ARRAY['Hang from the bar with an active shoulder position', 'Raise your straight legs up to touch the bar', 'Don''t rely purely on a big kip swing']::text[], false),
  ('Ab Wheel', 'Core', 'Rotation/Anti-rotation', ARRAY['Kneel, wheel in front of you, core braced', 'Roll out as far as you can control, then pull back in', 'Don''t let your lower back sag toward the floor']::text[], false),
  ('Stability Ball Rollout', 'Core', 'Rotation/Anti-rotation', ARRAY['Forearms on the ball, kneeling, core tight', 'Roll the ball forward while keeping a straight line', 'Don''t let your hips drop as you extend out']::text[], false),
  ('TRX Fallout', 'Core', 'Rotation/Anti-rotation', ARRAY['Grip the handles, arms extended in front, body straight', 'Lean forward as far as you can control, then pull back', 'Don''t let your lower back sag during the extension']::text[], false),
  ('Pallof Press', 'Core', 'Rotation/Anti-rotation', ARRAY['Stand side-on to the cable, handle at your chest', 'Press straight out, resisting the pull to rotate', 'Don''t let your torso twist toward the cable']::text[], false),
  ('Pallof Hold', 'Core', 'Rotation/Anti-rotation', ARRAY['Stand side-on to the cable, arms pressed straight out', 'Hold the position, resisting the sideways pull', 'Don''t let your hips or shoulders drift toward the cable']::text[], false),
  ('Cable Wood Chop', 'Core', 'Rotation/Anti-rotation', ARRAY['Cable set high, stand side-on, arms extended', 'Pull down and across your body in a chopping motion', 'Don''t just use your arms, rotate through your core']::text[], false),
  ('Cable Lift', 'Core', 'Rotation/Anti-rotation', ARRAY['Cable set low, stand side-on, arms extended', 'Pull up and across your body diagonally', 'Don''t just use your arms, drive the rotation from your core']::text[], false),
  ('Russian Twist', 'Core', 'Rotation/Anti-rotation', ARRAY['Sit with knees bent, torso leaned back slightly, feet up or down', 'Rotate the weight side to side, touching the floor', 'Don''t just move your arms, rotate through your torso']::text[], false),
  ('Medicine Ball Slam', 'Core', 'Rotation/Anti-rotation', ARRAY['Raise the ball overhead, core and lats engaged', 'Slam it down forcefully into the floor in front of you', 'Don''t round your lower back as you slam']::text[], false),
  ('Medicine Ball Rotational Throw', 'Core', 'Rotation/Anti-rotation', ARRAY['Stand side-on to a wall, ball at your hip', 'Rotate explosively and throw the ball into the wall', 'Don''t just use your arms, drive the throw from your hips']::text[], false),
  ('Landmine Rotation', 'Core', 'Rotation/Anti-rotation', ARRAY['Hold the landmine end with both arms extended in front', 'Rotate the bar side to side using your core', 'Don''t let your lower back twist excessively']::text[], false),
  ('Farmers Carry', 'Full body', 'Carry', ARRAY['Pick up heavy weights, shoulders back, core braced', 'Walk with short, controlled steps, staying tall', 'Don''t let your shoulders round forward or hips shift side to side']::text[], false),
  ('Suitcase Carry', 'Core', 'Carry', ARRAY['Weight held in one hand at your side', 'Walk tall, resisting the urge to lean toward the weight', 'Don''t let your torso tilt or your hips drop on one side']::text[], false),
  ('Overhead Carry', 'Core', 'Carry', ARRAY['Weight pressed fully overhead, arm locked out', 'Walk with controlled steps, staying braced and tall', 'Don''t let the weight drift forward or your ribs flare']::text[], false),
  ('Waiter Carry', 'Core', 'Carry', ARRAY['Weight balanced on an open palm overhead', 'Walk with controlled steps, arm fully locked out', 'Don''t let your wrist bend or the weight wobble']::text[], false),
  ('Copenhagen Plank', 'Core', 'Isolation', ARRAY['Top foot on a bench, bottom leg hovering, forearm down', 'Lift your hips so your body forms a straight line', 'Don''t let your hips rotate or sag toward the floor']::text[], false),
  ('Copenhagen Hold', 'Core', 'Isolation', ARRAY['Same setup as the Copenhagen plank, hold the top position', 'Keep hips level and body in a straight line', 'Don''t let your hips drop as fatigue sets in']::text[], false),
  ('Stir the Pot', 'Core', 'Isolation', ARRAY['Forearms on a stability ball, body in a plank line', 'Move your forearms in small circles on the ball', 'Don''t let your hips sway or sag during the circles']::text[], false),
  ('Dragon Flag', 'Core', 'Isolation', ARRAY['Lie on a bench, hold behind your head for support', 'Lift your body straight up, then lower under control', 'Don''t let your hips bend or your lower back sag']::text[], false),
  ('V-Up', 'Core', 'Isolation', ARRAY['Lie flat, arms extended overhead, legs straight', 'Fold at the hips, bringing hands and feet together', 'Don''t bend your knees to make it easier']::text[], false),
  ('Bicycle Crunch', 'Core', 'Rotation/Anti-rotation', ARRAY['Hands lightly behind your head, knees toward your chest', 'Rotate elbow to opposite knee, alternating sides', 'Don''t pull on your neck with your hands']::text[], false),
  ('Heel Touch', 'Core', 'Isolation', ARRAY['Lie on your back, knees bent, feet flat', 'Crunch sideways to touch one heel, then the other', 'Don''t lift your lower back off the floor to reach']::text[], false),
  ('Mountain Climber', 'Core', 'Isolation', ARRAY['Start in a high plank, hands under shoulders', 'Drive knees toward your chest alternating quickly', 'Don''t let your hips pike up as you go faster']::text[], false),
  ('Dead Hang', 'Back', 'Vertical pull', ARRAY['Grip the bar, arms fully extended, shoulders relaxed down', 'Hang and breathe, letting your lats and shoulders decompress', 'Don''t shrug your shoulders up toward your ears']::text[], false),
  ('Scapular Pull-Up', 'Back', 'Vertical pull', ARRAY['Hang from the bar, arms straight', 'Pull your shoulder blades down and together without bending your elbows', 'Don''t bend your arms, this is scapula-only movement']::text[], false),
  ('Scapular Push-Up', 'Chest', 'Isolation', ARRAY['Start in a plank or push-up position, arms straight', 'Let your shoulder blades squeeze together, then push them apart', 'Don''t bend your elbows during the movement']::text[], false),
  ('Band Pull-Aparts', 'Shoulders', 'Isolation', ARRAY['Hold the band at shoulder height, arms extended', 'Pull the band apart, squeezing your shoulder blades together', 'Don''t let your shoulders shrug up toward your ears']::text[], false),
  ('Band Pass Throughs', 'Shoulders', 'Isolation', ARRAY['Hold a light band wide with both hands in front', 'Raise the band overhead and behind you, then back', 'Don''t bend your elbows or narrow your grip to cheat the range']::text[], false),
  ('Shoulder CARs', 'Shoulders', 'Isolation', ARRAY['Brace your core, arm starts at your side', 'Trace the largest smooth circle your shoulder can control', 'Don''t let your torso move to fake extra range']::text[], false),
  ('Hip CARs', 'Full body', 'Isolation', ARRAY['Stand tall or hold support, brace your core', 'Move your hip through its largest controlled circle', 'Don''t let your lower back arch to add fake range']::text[], true),
  ('90/90 Hip Rotation', 'Glutes', 'Isolation', ARRAY['Sit with both legs bent at 90°, one in front, one to the side', 'Rotate your knees from one side to the other, staying tall', 'Don''t use your hands to yank yourself through the rotation']::text[], false),
  ('World''s Greatest Stretch', 'Full body', 'Isolation', ARRAY['Step into a deep lunge, hand down inside your front foot', 'Rotate your torso and reach the same-side arm up', 'Don''t let your back knee touch down or rush the rotation']::text[], true),
  ('Cat-Cow', 'Core', 'Isolation', ARRAY['Start on all fours, hands under shoulders', 'Alternate arching your back up and dropping it down', 'Don''t rush, move through your whole spine each rep']::text[], true),
  ('Thoracic Rotation', 'Core', 'Rotation/Anti-rotation', ARRAY['Kneel or side-lie, hips stacked and stable', 'Rotate your upper back, reaching one arm toward the ceiling', 'Don''t let your hips rotate along with your torso']::text[], false),
  ('Open Book Rotation', 'Core', 'Rotation/Anti-rotation', ARRAY['Side-lying, knees bent in front of you', 'Open your top arm across your body like a book', 'Don''t let your hips lift off the floor']::text[], true),
  ('Thread the Needle', 'Core', 'Rotation/Anti-rotation', ARRAY['Start on all fours, spine neutral', 'Thread one arm under your body, rotating your torso', 'Don''t let your hips shift out of position']::text[], true),
  ('Half-Kneeling Hip Flexor Stretch', 'Glutes', 'Isolation', ARRAY['Kneel with one leg forward at 90°', 'Squeeze the glute of your back leg and push hips forward', 'Don''t let your lower back arch to fake the stretch']::text[], false),
  ('Couch Stretch', 'Quads', 'Isolation', ARRAY['Back shin against a wall or couch, front foot forward', 'Sink your hips down and forward under control', 'Don''t let your lower back arch to compensate']::text[], true),
  ('Pigeon Stretch', 'Glutes', 'Isolation', ARRAY['Front shin angled in front of you, back leg extended', 'Fold forward over your front leg to deepen the stretch', 'Don''t force the front knee if you feel joint pain']::text[], true),
  ('Hamstring Stretch', 'Hamstrings', 'Isolation', ARRAY['Extend one leg out, hinge forward from your hips', 'Reach toward your foot, keeping your back flat', 'Don''t round your lower back to reach further']::text[], false),
  ('Calf Stretch', 'Calves', 'Isolation', ARRAY['Back leg straight, heel pressed into the floor', 'Lean forward into a wall until you feel a stretch', 'Don''t let your back heel lift off the floor']::text[], false),
  ('Lat Stretch', 'Back', 'Isolation', ARRAY['Hold an overhead support, sink your hips back and down', 'Let your lat stretch as your hips drop away from your hands', 'Don''t force the stretch through pain, ease into it']::text[], false),
  ('Pec Stretch', 'Chest', 'Isolation', ARRAY['Forearm against a wall or doorframe at shoulder height', 'Rotate your torso away from the wall to feel the stretch', 'Don''t shrug your shoulder up during the stretch']::text[], false),
  ('Child''s Pose', 'Back', 'Isolation', ARRAY['Sit back onto your heels, arms extended forward', 'Relax your chest toward the floor, breathing deeply', 'Don''t force your hips down if it strains your knees']::text[], true),
  ('Foam Rolling', 'Full body', 'Isolation', ARRAY['Position the roller under the target muscle, body relaxed', 'Roll slowly, pausing on tender spots for a few breaths', 'Don''t roll directly over joints or bony areas']::text[], true),
  ('Ankle Mobility Drill', 'Calves', 'Isolation', ARRAY['Foot flat, knee driving forward over your toes', 'Rock your knee forward and back, keeping your heel down', 'Don''t let your heel lift off the floor']::text[], false),
  ('Wall Ankle Mobilization', 'Calves', 'Isolation', ARRAY['Foot a few inches from a wall, knee tracking forward', 'Drive your knee toward the wall, heel staying planted', 'Don''t let your heel come up to reach the wall']::text[], false),
  ('Goblet Squat Hold', 'Quads', 'Squat', ARRAY['Hold a dumbbell or kettlebell at your chest', 'Squat down and hold the bottom position, chest tall', 'Don''t let your lower back round in the bottom position']::text[], false),
  ('Deep Squat Hold', 'Quads', 'Squat', ARRAY['Feet slightly wider than shoulder width', 'Sink into the deepest comfortable squat and hold', 'Don''t let your heels lift or your lower back round']::text[], false),
  ('Hip Airplane', 'Glutes', 'Isolation', ARRAY['Balance on one leg, slight hinge forward', 'Rotate your hips and torso while keeping your standing leg stable', 'Don''t let your standing knee wobble or cave in']::text[], false),
  ('Glute Med Walk', 'Glutes', 'Isolation', ARRAY['Band around your ankles, slight squat position', 'Step sideways with control, keeping tension on the band', 'Don''t let your knees cave in as you step']::text[], false),
  ('Terminal Knee Extension', 'Quads', 'Isolation', ARRAY['Band anchored behind your knee, slight knee bend', 'Straighten your knee fully against the band''s pull', 'Don''t lock out aggressively or lean your torso back']::text[], false),
  ('Spanish Squat Hold', 'Quads', 'Squat', ARRAY['Band anchored behind your knees, feet shoulder width', 'Sit back into the band and hold, torso upright', 'Don''t let your knees travel forward past your toes']::text[], false),
  ('TKE Band Extension', 'Quads', 'Isolation', ARRAY['Band looped behind your knee, standing with a soft bend', 'Extend your knee fully against the band', 'Don''t rush the rep, control the return']::text[], false),
  ('Face Pull External Rotation', 'Shoulders', 'Isolation', ARRAY['Rope at face height, pull to your face first', 'At the end, rotate your hands back and up', 'Don''t let your elbows drop below shoulder height']::text[], false),
  ('Serratus Wall Slide', 'Shoulders', 'Isolation', ARRAY['Forearms against a wall, elbows at shoulder height', 'Slide your arms up while pressing your ribs down', 'Don''t let your lower back arch as you reach up']::text[], false),
  ('Prone Y Raise', 'Shoulders', 'Isolation', ARRAY['Lie face-down on an incline bench or floor', 'Raise your arms overhead in a Y shape, thumbs up', 'Don''t shrug your shoulders instead of raising your arms']::text[], false),
  ('Prone T Raise', 'Shoulders', 'Isolation', ARRAY['Lie face-down, arms hanging straight down', 'Raise your arms out to the sides forming a T', 'Don''t use momentum to swing the weights up']::text[], false),
  ('Prone W Raise', 'Shoulders', 'Isolation', ARRAY['Lie face-down, elbows bent at your sides', 'Raise your arms into a W shape, squeezing shoulder blades', 'Don''t let your elbows drop below your torso']::text[], false),
  ('Banded Row', 'Back', 'Horizontal pull', ARRAY['Anchor the band at chest height, step back for tension', 'Pull elbows back, squeezing your shoulder blades together', 'Don''t let your torso lean back to help the pull']::text[], false),
  ('Banded Good Morning', 'Hamstrings', 'Hinge', ARRAY['Band under your feet, over your shoulders, soft knees', 'Hinge forward until you feel a hamstring stretch', 'Don''t round your back as you hinge forward']::text[], false),
  ('Sled Push', 'Full body', 'Carry', ARRAY['Hands on the high or low handles, arms extended', 'Drive through your legs in short, powerful steps', 'Don''t round your back or let your hips pike up']::text[], false),
  ('Sled Pull', 'Full body', 'Carry', ARRAY['Attach the rope or straps, face the sled', 'Pull hand over hand, driving through your legs', 'Don''t jerk with your arms instead of your legs']::text[], false),
  ('Backward Sled Drag', 'Quads', 'Carry', ARRAY['Face the sled, straps in hand, knees slightly bent', 'Walk backward with controlled, driving steps', 'Don''t lean too far back or take huge strides']::text[], false),
  ('Battle Ropes', 'Full body', 'Isolation', ARRAY['Athletic stance, knees soft, core braced', 'Whip the ropes in continuous waves or slams', 'Don''t just use your arms, drive power from your legs and core']::text[], true),
  ('Battle Rope Waves', 'Shoulders', 'Isolation', ARRAY['Athletic stance, grip an end in each hand', 'Alternate driving each arm up and down rapidly', 'Don''t let your shoulders shrug up as you fatigue']::text[], true),
  ('Battle Rope Slams', 'Full body', 'Isolation', ARRAY['Athletic stance, ropes raised overhead together', 'Slam both ropes down forcefully together', 'Don''t round your lower back on the slam']::text[], true),
  ('SkiErg', 'Back', 'Vertical pull', ARRAY['Handles overhead, hinge slightly forward to start', 'Pull down and back, driving through your core and lats', 'Don''t just use your arms, involve your hips and core']::text[], false),
  ('Rower', 'Back', 'Horizontal pull', ARRAY['Strap feet in, grip the handle, start with legs bent', 'Drive legs first, then lean back, then pull the handle in', 'Don''t pull with your arms before your legs finish driving']::text[], false),
  ('Rowing Machine', 'Back', 'Horizontal pull', ARRAY['Same setup as the rower: legs, then hips, then arms', 'Sequence the drive: legs, body, arms on every stroke', 'Don''t round your lower back during the drive']::text[], false),
  ('Assault Bike', 'Full body', 'Carry', ARRAY['Sit tall, hands on the moving handles, feet on the pedals', 'Push and pull with your arms while driving with your legs', 'Don''t let your form collapse as you fatigue']::text[], true),
  ('Air Bike', 'Full body', 'Carry', ARRAY['Same setup as the assault bike, tall posture', 'Drive arms and legs together for maximum output', 'Don''t hunch forward as pace increases']::text[], true),
  ('Stationary Bike', 'Quads', 'Isolation', ARRAY['Seat height set so your knee has a slight bend at full extension', 'Pedal with a smooth, consistent cadence', 'Don''t let your knees cave in toward the frame']::text[], true),
  ('Spin Bike', 'Quads', 'Isolation', ARRAY['Set seat and handlebar height to your body', 'Keep a smooth cadence, matching resistance to the effort', 'Don''t rock your hips side to side on hard efforts']::text[], true),
  ('Elliptical', 'Full body', 'Isolation', ARRAY['Stand tall, hands light on the moving handles', 'Drive through a smooth, full stride', 'Don''t lean heavily on the handles to support your weight']::text[], true),
  ('Treadmill Walk', 'Full body', 'Isolation', ARRAY['Stand tall, don''t hold onto the rails', 'Walk with a natural stride and arm swing', 'Don''t lean forward or shorten your stride to keep up']::text[], true),
  ('Incline Treadmill Walk', 'Glutes', 'Isolation', ARRAY['Set a moderate incline, stand tall', 'Drive through your whole foot with each step', 'Don''t hold the rails to take weight off your legs']::text[], true),
  ('Treadmill Run', 'Full body', 'Isolation', ARRAY['Stand tall, relaxed shoulders, eyes forward', 'Land with your foot under your hips, not out in front', 'Don''t overstride or lean back']::text[], true),
  ('Stair Climber', 'Glutes', 'Isolation', ARRAY['Stand tall, light hand contact on the rails only', 'Step fully onto each stair, driving through your heel', 'Don''t lean on the rails to take weight off your legs']::text[], true),
  ('Stairmaster', 'Glutes', 'Isolation', ARRAY['Stand tall, hands light on the side rails', 'Take full steps, driving through your whole foot', 'Don''t rely on the rails to support your body weight']::text[], true),
  ('VersaClimber', 'Full body', 'Carry', ARRAY['Stand tall in the footholds, opposite arm and leg move together', 'Drive with long, controlled reaches', 'Don''t shorten your range to increase speed']::text[], true),
  ('Jump Rope', 'Calves', 'Isolation', ARRAY['Elbows close to your sides, wrists doing the turning', 'Stay light on the balls of your feet', 'Don''t jump too high or land flat-footed']::text[], false),
  ('Box Jump', 'Quads', 'Squat', ARRAY['Athletic stance, arms ready to swing', 'Swing your arms and jump, landing softly on the box', 'Don''t land with your knees caving in, step down after']::text[], false),
  ('Step Jump', 'Quads', 'Squat', ARRAY['Stand facing the platform, knees soft', 'Jump and land with both feet fully on the step', 'Don''t land with a stiff, straight-legged landing']::text[], false),
  ('Broad Jump', 'Quads', 'Squat', ARRAY['Athletic stance, arms back to load the jump', 'Swing arms forward and jump as far as possible, land softly', 'Don''t land stiff-legged, absorb with bent knees']::text[], false),
  ('Burpee', 'Full body', 'Squat', ARRAY['Drop to a plank, chest to the floor', 'Jump feet back in and explode straight up', 'Don''t let your lower back sag in the plank position']::text[], false),
  ('Burpee Box Jump', 'Full body', 'Squat', ARRAY['Drop to a plank, chest to the floor', 'Jump feet in, then jump up onto the box', 'Don''t rush the box landing, land with soft knees']::text[], false),
  ('Kettlebell Clean', 'Full body', 'Hinge', ARRAY['Hike the bell back like a swing, hinge at the hips', 'Pull and rotate the bell to rack position at your shoulder', 'Don''t let the bell bang into your forearm, guide it in']::text[], false),
  ('Kettlebell Snatch', 'Full body', 'Hinge', ARRAY['Hike the bell back, hinge to generate power', 'Pull the bell up and punch your hand through overhead', 'Don''t muscle it up with your arm, drive from your hips']::text[], false),
  ('Kettlebell Goblet Squat', 'Quads', 'Squat', ARRAY['Hold the bell at your chest by the horns', 'Squat down between your knees, chest tall', 'Don''t let the bell pull your chest forward and down']::text[], false),
  ('Kettlebell Turkish Get-Up', 'Full body', 'Isolation', ARRAY['Press the bell overhead, arm locked out throughout', 'Move through each step slowly, eyes on the bell', 'Don''t let the arm bend or the bell drift off vertical']::text[], true),
  ('Medicine Ball Throw', 'Full body', 'Rotation/Anti-rotation', ARRAY['Load the ball behind you, hips and knees bent', 'Throw explosively, extending your whole body', 'Don''t just use your arms, drive from your legs and hips']::text[], false),
  ('Wall Ball', 'Quads', 'Squat', ARRAY['Hold the ball at your chest, feet shoulder width', 'Squat down, then drive up and throw the ball to the target', 'Don''t just use your arms, drive the throw from your legs']::text[], false),
  ('Farmer''s Carry', 'Full body', 'Carry', ARRAY['Pick up heavy weights, shoulders back, core braced', 'Walk with short, controlled steps, staying tall', 'Don''t let your shoulders round forward or torso lean']::text[], false),
  ('Trap Bar Carry', 'Full body', 'Carry', ARRAY['Stand centered in the trap bar, chest up to lift', 'Walk tall with controlled steps', 'Don''t let your shoulders round forward under the load']::text[], false),
  ('Sandbag Carry', 'Full body', 'Carry', ARRAY['Hug or shoulder the bag securely before walking', 'Walk with short, controlled steps, staying braced', 'Don''t let the bag shift and pull you off balance']::text[], false),
  ('Sandbag Clean', 'Full body', 'Hinge', ARRAY['Hinge down, grip the bag handles or sides', 'Pull and pop the bag up to your shoulder or chest', 'Don''t round your lower back lifting the bag off the floor']::text[], false),
  ('Sandbag Squat', 'Full body', 'Squat', ARRAY['Load the bag on your back or at your chest', 'Squat down, keeping your torso as upright as possible', 'Don''t let the shifting weight round your back']::text[], false),
  ('Tire Flip', 'Full body', 'Hinge', ARRAY['Hinge down, grip low under the tire', 'Drive through your legs and extend your hips to flip it', 'Don''t round your back trying to muscle it with your arms']::text[], false),
  ('Rope Climb', 'Back', 'Vertical pull', ARRAY['Grip the rope, engage your lats before pulling', 'Pull hand over hand, using your legs to assist if possible', 'Don''t rely purely on your arms and grip']::text[], false),
  ('Bear Crawl', 'Core', 'Rotation/Anti-rotation', ARRAY['Hands under shoulders, knees hovering off the floor', 'Move opposite hand and foot together, hips level', 'Don''t let your hips rise up or your back sag']::text[], false),
  ('Crab Walk', 'Core', 'Rotation/Anti-rotation', ARRAY['Hands and feet on the floor, hips lifted, facing up', 'Move opposite hand and foot together, hips staying level', 'Don''t let your hips sag toward the floor']::text[], false),
  ('Prowler Push', 'Full body', 'Carry', ARRAY['Hands on the high or low handles, arms extended', 'Drive through your legs in short, powerful steps', 'Don''t round your back or let your hips pike up']::text[], false),
  ('Prowler Sprint', 'Full body', 'Carry', ARRAY['Light load, hands on the handles, low body angle', 'Drive hard and fast through your legs', 'Don''t let your form collapse chasing speed']::text[], false),
  ('Cable Row', 'Back', 'Horizontal pull', ARRAY['Sit tall, feet on the platform, slight forward lean to start', 'Pull the handle to your torso, elbows close to your sides', 'Don''t round your back or use momentum to yank']::text[], false),
  ('Cable Chest Press', 'Chest', 'Horizontal push', ARRAY['Split stance, cable handles at chest height', 'Press straight forward, squeeze at full extension', 'Don''t lean into the press to add fake range']::text[], false),
  ('Cable Shoulder Press', 'Shoulders', 'Vertical push', ARRAY['Cables at shoulder height, stand or sit tall', 'Press straight overhead to full extension', 'Don''t arch your lower back to finish the press']::text[], false),
  ('Cable Lunge', 'Quads', 'Lunge', ARRAY['Cable anchored low behind you, handle at your waist', 'Step into a lunge against the resistance', 'Don''t let the cable pull you off balance']::text[], false),
  ('Cable Pull Through', 'Glutes', 'Hinge', ARRAY['Cable between your legs, hinge forward, soft knees', 'Drive your hips forward to stand tall, squeezing glutes', 'Don''t round your back or squat the weight through']::text[], false),
  ('Cable Abduction', 'Glutes', 'Isolation', ARRAY['Cuff on your ankle, cable anchored at the opposite low point', 'Lift your leg out to the side against the cable', 'Don''t lean your torso to help swing the leg']::text[], false),
  ('Cable Adduction', 'Glutes', 'Isolation', ARRAY['Cuff on your ankle, cable anchored to the same-side low point', 'Pull your leg across your body against the cable', 'Don''t rotate your hips to assist the movement']::text[], false),
  ('Cable Lateral Raise', 'Shoulders', 'Isolation', ARRAY['Cable at the lowest setting, stand side-on to the stack', 'Raise your arm out to shoulder height', 'Don''t lean away from the cable to cheat the raise']::text[], false),
  ('Smith Machine Row', 'Back', 'Horizontal pull', ARRAY['Set the bar height, hinge forward with a flat back', 'Pull the bar to your torso along the fixed path', 'Don''t round your lower back to reach the bar']::text[], false),
  ('Smith Machine RDL', 'Hamstrings', 'Hinge', ARRAY['Bar at hip height, soft knees, flat back', 'Hinge hips back, bar sliding down your legs', 'Don''t round your lower back or bend your knees to squat it']::text[], false),
  ('Smith Machine Lunge', 'Quads', 'Lunge', ARRAY['Bar across your upper back, split stance under it', 'Lower straight down along the fixed bar path', 'Don''t let your front knee travel past your toes']::text[], false),
  ('Machine Pullover', 'Back', 'Isolation', ARRAY['Set seat so the pivot aligns with your shoulders', 'Pull the bar down in an arc to your thighs', 'Don''t bend your elbows more to help the pull']::text[], false),
  ('Machine Bicep Curl', 'Biceps', 'Isolation', ARRAY['Set seat so upper arms rest on the pad', 'Curl through a full range, squeeze at the top', 'Don''t let the weight stack slam on the way down']::text[], false),
  ('Machine Preacher Curl', 'Biceps', 'Isolation', ARRAY['Upper arms flat against the preacher pad', 'Curl up without lifting your elbows off the pad', 'Don''t let the weight drop fast at the bottom']::text[], false),
  ('Machine Tricep Dip', 'Triceps', 'Vertical push', ARRAY['Set seat/handle height for a full range of motion', 'Lean forward slightly and lower under control', 'Don''t let the weight stack drop you into the bottom']::text[], false),
  ('Machine Ab Crunch', 'Core', 'Isolation', ARRAY['Adjust the pad to sit against your upper chest', 'Curl your torso forward, squeezing your abs', 'Don''t use your arms to pull the weight down']::text[], false),
  ('Machine Back Extension', 'Back', 'Hinge', ARRAY['Set the pad at your hip crease, secure your legs', 'Extend your torso back to a flat line, control the return', 'Don''t hyperextend past neutral at the top']::text[], false),
  ('Machine Glute Kickback', 'Glutes', 'Isolation', ARRAY['Foot on the platform, torso braced against the pad', 'Kick your leg back and up, squeezing your glute', 'Don''t hyperextend your lower back to add range']::text[], false),
  ('Machine Hip Thrust', 'Glutes', 'Hinge', ARRAY['Set the pad across your hips, back against the seat', 'Drive your hips up, squeezing your glutes at the top', 'Don''t push through your toes or arch your lower back']::text[], false),
  ('Machine Adductor', 'Glutes', 'Isolation', ARRAY['Sit tall, pads against your inner thighs, legs open', 'Squeeze your legs together against the resistance', 'Don''t use momentum or bounce the weight closed']::text[], false),
  ('Machine Abductor', 'Glutes', 'Isolation', ARRAY['Sit tall, pads against your outer thighs, legs together', 'Push your legs apart against the resistance', 'Don''t lean forward or use momentum to open your legs']::text[], false)
on conflict (name) do update set
  muscle_group = excluded.muscle_group,
  movement_pattern = excluded.movement_pattern,
  coaching_cues = excluded.coaching_cues,
  needs_review = excluded.needs_review;

-- ---------- Part B: best-effort tagging of existing custom exercises ----------
-- Temporary helper function - drops itself at the end of this migration.
create or replace function pg_temp.exercise_taxonomy_guess(ex_name text)
returns table(muscle_group text, movement_pattern text, cues text[]) as $$
declare
  n text := lower(ex_name);
begin
  -- Ordered most-specific first. Falls through to a generic Full body /
  -- Isolation guess if nothing matches. This mirrors, in SQL, the same
  -- keyword logic used to hand-author the built-in taxonomy in
  -- src/features/train/exerciseTaxonomy.js - see DECISIONS.md.
  return query select 'Quads', 'Squat', ARRAY['Set your stance and brace your core before descending', 'Control the descent, drive back up through your whole foot', 'Don''t let your knees cave in or your lower back round']
    where n ~ '(squat|leg press)';
  if found then return; end if;

  return query select 'Quads', 'Lunge', ARRAY['Torso tall, step under control', 'Lower until both knees approach 90 degrees', 'Don''t let your front knee cave in or shoot past your toes']
    where n ~ '(lunge|split squat|step-?up)';
  if found then return; end if;

  return query select 'Hamstrings', 'Hinge', ARRAY['Soft knees, flat back, hinge from your hips', 'Feel the stretch in your hamstrings as you lower', 'Don''t round your lower back to reach further']
    where n ~ '(rdl|romanian|good morning|stiff-?leg)';
  if found then return; end if;

  return query select 'Back', 'Hinge', ARRAY['Brace hard, flat back, bar or weight close to your body', 'Drive through your legs, chest and hips rise together', 'Don''t let your lower back round to move the weight']
    where n ~ '(deadlift|rack pull|block pull)';
  if found then return; end if;

  return query select 'Glutes', 'Hinge', ARRAY['Set up with your torso braced, hips as the driver', 'Drive your hips through, squeezing your glutes hard', 'Don''t substitute your lower back for your glutes']
    where n ~ '(hip thrust|glute bridge|pull-?through)';
  if found then return; end if;

  return query select 'Calves', 'Isolation', ARRAY['Full stretch at the bottom, balls of your feet loaded', 'Rise as high as you can onto your toes', 'Don''t bounce, control both directions']
    where n ~ '(calf)';
  if found then return; end if;

  return query select 'Back', 'Vertical pull', ARRAY['Start from a dead hang or full stretch, shoulders set', 'Pull with your back, not just your arms', 'Don''t swing or use momentum to cheat the range']
    where n ~ '(pull-?up|pulldown|chin-?up)';
  if found then return; end if;

  return query select 'Back', 'Horizontal pull', ARRAY['Hinge or sit tall, chest up, shoulders back', 'Pull elbows back, squeezing your shoulder blades together', 'Don''t round your back or yank with momentum']
    where n ~ '(row)';
  if found then return; end if;

  return query select 'Chest', 'Horizontal push', ARRAY['Set your shoulder blades back and down before pressing', 'Lower under control to a full stretch', 'Don''t let your elbows flare or bounce off the bottom']
    where n ~ '(bench press|chest press|push-?up|fly|flye|crossover)';
  if found then return; end if;

  return query select 'Shoulders', 'Vertical push', ARRAY['Brace your core, bar or weight starts at shoulder height', 'Press straight overhead to full lockout', 'Don''t arch your lower back to finish the press']
    where n ~ '(shoulder press|overhead press|military press)';
  if found then return; end if;

  return query select 'Triceps', 'Vertical push', ARRAY['Torso upright, elbows tracking close to your body', 'Lower under control, elbows bending to about 90 degrees', 'Don''t flare your elbows out to the sides']
    where n ~ '(dip)';
  if found then return; end if;

  return query select 'Shoulders', 'Isolation', ARRAY['Slight bend in the elbows, controlled setup', 'Raise to about shoulder height, leading with your elbows', 'Don''t swing the weight up with momentum']
    where n ~ '(lateral raise|delt|shrug|upright row)';
  if found then return; end if;

  return query select 'Biceps', 'Isolation', ARRAY['Elbows pinned to your sides throughout', 'Curl up without swinging your torso', 'Don''t let your elbows drift forward as you curl']
    where n ~ '(curl)' and n !~ '(leg curl)';
  if found then return; end if;

  return query select 'Hamstrings', 'Isolation', ARRAY['Set the pad snug against your ankles or shins', 'Curl through a full, controlled range', 'Don''t let your hips lift to cheat the range']
    where n ~ '(leg curl)';
  if found then return; end if;

  return query select 'Triceps', 'Isolation', ARRAY['Elbows pinned to your sides or fixed overhead', 'Extend to full lockout, squeeze at the end', 'Don''t let your elbows flare or drift as you extend']
    where n ~ '(tricep|pushdown|skull crusher|kickback)';
  if found then return; end if;

  return query select 'Quads', 'Isolation', ARRAY['Back against the pad, controlled setup', 'Extend through a full range, squeeze at the top', 'Don''t use momentum or swing the weight up']
    where n ~ '(leg extension)';
  if found then return; end if;

  return query select 'Glutes', 'Isolation', ARRAY['Set up with control, brace your core', 'Move through a full range against the resistance', 'Don''t use momentum or your lower back to cheat the rep']
    where n ~ '(glute|kickback|abduction|adduction)';
  if found then return; end if;

  return query select 'Core', 'Isolation', ARRAY['Brace your core before you start moving', 'Move through a controlled, full range', 'Don''t let your lower back arch or sag']
    where n ~ '(plank|crunch|sit-?up|ab |core|hollow)';
  if found then return; end if;

  return query select 'Core', 'Rotation/Anti-rotation', ARRAY['Brace your core, set a stable base', 'Rotate or resist rotation with control, not momentum', 'Don''t let your lower back twist excessively']
    where n ~ '(rotation|twist|chop|wood chop|pallof)';
  if found then return; end if;

  return query select 'Full body', 'Carry', ARRAY['Brace your core, shoulders back before you move', 'Walk or move with short, controlled steps', 'Don''t let your torso round or lean to one side']
    where n ~ '(carry|farmer|sled|prowler)';
  if found then return; end if;

  -- Nothing matched: generic best-effort fallback.
  return query select 'Full body', 'Isolation', ARRAY['Set up with control before starting the movement', 'Move through a full, controlled range of motion', 'Don''t use momentum to compensate for poor form'];
end;
$$ language plpgsql;

-- Apply the guess to every custom-exercise item that doesn't already carry
-- taxonomy fields (so re-running this migration never clobbers exercises
-- already tagged by a coach through the updated add/edit form).
do $$
declare
  r record;
  item jsonb;
  new_items jsonb;
  guess record;
  changed boolean;
begin
  for r in
    select id, data from public.trainer_data where section = 'custom_exercise_library'
  loop
    new_items := '[]'::jsonb;
    changed := false;
    for item in select * from jsonb_array_elements(coalesce(r.data->'items', '[]'::jsonb))
    loop
      if item ? 'muscleGroup' then
        new_items := new_items || jsonb_build_array(item);
      else
        select * into guess from pg_temp.exercise_taxonomy_guess(coalesce(item->>'name', ''));
        item := item
          || jsonb_build_object('muscleGroup', guess.muscle_group)
          || jsonb_build_object('movementPattern', guess.movement_pattern)
          || jsonb_build_object('coachingCues', to_jsonb(guess.cues))
          || jsonb_build_object('needsReview', true);
        new_items := new_items || jsonb_build_array(item);
        changed := true;
      end if;
    end loop;
    if changed then
      update public.trainer_data set data = jsonb_set(r.data, '{items}', new_items) where id = r.id;
    end if;
  end loop;
end $$;

drop function if exists pg_temp.exercise_taxonomy_guess(text);
