import type { Difficulty, Question } from './questions';

// Questions that ship with the app, for when the Open Trivia Database can't be
// reached (offline, rate-limited, down) or has run short of a difficulty.
// Written for Squigglepig rather than taken from OpenTDB, so they aren't under
// its licence: general knowledge for all ages, not tied to any one country,
// each answer checked. Add freely; keep the three wrong answers clearly wrong.
//
// Each row: [category, question, right answer, three wrong answers].
type Row = [string, string, string, string, string, string];

const EASY: Row[] = [
  ['Animals', 'How many legs does a spider have?', '8', '6', '10', '12'],
  ['Geography', 'What is the largest ocean on Earth?', 'The Pacific', 'The Atlantic', 'The Indian', 'The Arctic'],
  ['Science', 'Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
  ['Animals', 'What do bees make?', 'Honey', 'Jam', 'Syrup', 'Butter'],
  ['General', 'How many days are there in a leap year?', '366', '365', '364', '367'],
  ['Science', 'At what temperature, in degrees Celsius, does water freeze?', '0', '32', '10', '-10'],
  ['Animals', 'Which animal is called the king of the jungle?', 'The lion', 'The tiger', 'The elephant', 'The gorilla'],
  ['Art', 'What colour do you get by mixing blue and yellow?', 'Green', 'Purple', 'Orange', 'Brown'],
  ['Geography', 'How many continents are there?', '7', '5', '6', '8'],
  ['Animals', 'What is the largest mammal?', 'The blue whale', 'The elephant', 'The giraffe', 'The hippopotamus'],
  ['Science', 'Which gas do plants take in from the air?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
  ['Geography', 'What is the capital of France?', 'Paris', 'Lyon', 'Marseille', 'Nice'],
  ['General', 'How many sides does a hexagon have?', '6', '5', '7', '8'],
  ['Science', 'What is the closest star to Earth?', 'The Sun', 'Sirius', 'Polaris', 'Alpha Centauri'],
  ['Animals', 'What is a baby frog called?', 'A tadpole', 'A cub', 'A kid', 'A calf'],
  ['Music', 'Which instrument usually has 88 keys?', 'The piano', 'The guitar', 'The harp', 'The trumpet'],
  ['Science', 'What is H₂O better known as?', 'Water', 'Salt', 'Air', 'Sugar'],
  ['General', 'How many minutes are there in an hour?', '60', '100', '30', '45'],
  ['General', 'Which bird is a symbol of peace?', 'The dove', 'The eagle', 'The crow', 'The parrot'],
  ['General', 'What shape has three sides?', 'A triangle', 'A square', 'A circle', 'A pentagon'],
  ['General', 'Which fruit is dried to make raisins?', 'Grapes', 'Plums', 'Cherries', 'Figs'],
  ['History', 'In which country are the pyramids of Giza?', 'Egypt', 'Mexico', 'Greece', 'Peru'],
  ['Science', 'What is the hardest natural substance?', 'Diamond', 'Gold', 'Iron', 'Quartz'],
  ['Science', 'How many colours are in a rainbow?', '7', '5', '6', '8'],
  ['Animals', 'Which animal has a long trunk?', 'The elephant', 'The rhino', 'The giraffe', 'The hippo'],
  ['Animals', 'What do caterpillars turn into?', 'Butterflies', 'Beetles', 'Bees', 'Dragonflies'],
  ['Sports', 'Which sport uses a shuttlecock?', 'Badminton', 'Tennis', 'Squash', 'Table tennis'],
  ['Sports', 'How many players does a football (soccer) team have on the pitch?', '11', '9', '10', '12'],
  ['Animals', 'What is the tallest animal?', 'The giraffe', 'The elephant', 'The ostrich', 'The camel'],
  ['General', 'Which month has the fewest days?', 'February', 'April', 'June', 'November'],
];

const MEDIUM: Row[] = [
  ['Geography', 'What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
  ['Science', 'Which element has the chemical symbol O?', 'Oxygen', 'Gold', 'Silver', 'Iron'],
  ['Art', 'Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Vincent van Gogh'],
  ['Geography', 'What is the longest river in Africa?', 'The Nile', 'The Congo', 'The Niger', 'The Zambezi'],
  ['Science', 'How many bones are in the adult human body?', '206', '186', '216', '256'],
  ['Science', 'Which planet has the biggest, brightest rings?', 'Saturn', 'Jupiter', 'Uranus', 'Neptune'],
  ['Geography', 'What is the largest hot desert in the world?', 'The Sahara', 'The Gobi', 'The Kalahari', 'The Arabian'],
  ['History', 'In which year did people first land on the Moon?', '1969', '1965', '1972', '1959'],
  ['General', 'Which language has the most native speakers?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi'],
  ['General', 'What is the smallest prime number?', '2', '1', '3', '0'],
  ['Science', "What is the main gas in Earth's air?", 'Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'],
  ['Geography', 'Which country has the most people?', 'India', 'China', 'The United States', 'Indonesia'],
  ['Geography', 'What is the currency of Japan?', 'The yen', 'The won', 'The yuan', 'The ringgit'],
  ['Music', 'How many strings does a violin have?', '4', '5', '6', '3'],
  ['Science', 'Who came up with the theory of general relativity?', 'Albert Einstein', 'Isaac Newton', 'Galileo Galilei', 'Niels Bohr'],
  ['Science', 'What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
  ['Geography', 'Which ocean lies between Africa and Australia?', 'The Indian Ocean', 'The Atlantic Ocean', 'The Pacific Ocean', 'The Arctic Ocean'],
  ['Geography', 'What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
  ['Animals', 'What is the fastest land animal?', 'The cheetah', 'The lion', 'The pronghorn', 'The greyhound'],
  ['General', 'What is the square root of 144?', '12', '14', '11', '16'],
  ['Science', 'Which blood cells fight infection?', 'White blood cells', 'Red blood cells', 'Platelets', 'Nerve cells'],
  ['Sports', 'In which country did the ancient Olympic Games begin?', 'Greece', 'Italy', 'France', 'Egypt'],
  ['Books', 'Who wrote Romeo and Juliet?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Christopher Marlowe'],
  ['Animals', 'How many hearts does an octopus have?', '3', '1', '2', '4'],
  ['Geography', 'What is the capital of Brazil?', 'Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'],
  ['Science', 'Which metal is liquid at room temperature?', 'Mercury', 'Lead', 'Tin', 'Aluminium'],
  ['Geography', 'Which mountain range is Mount Everest in?', 'The Himalayas', 'The Andes', 'The Alps', 'The Rockies'],
  ['Science', 'What is the hottest planet in our solar system?', 'Venus', 'Mercury', 'Mars', 'Jupiter'],
  ['History', 'Which ship sank on its first voyage in 1912?', 'The Titanic', 'The Lusitania', 'The Britannic', 'The Mayflower'],
  ['Science', 'How many teeth does an adult usually have?', '32', '28', '30', '36'],
];

const HARD: Row[] = [
  ['Science', 'What is the chemical symbol for tungsten?', 'W', 'Tu', 'Tg', 'Tn'],
  ['Geography', 'Which country, counting its overseas territories, has the most time zones?', 'France', 'Russia', 'The United States', 'The United Kingdom'],
  ['Geography', 'What is the smallest country in the world by area?', 'Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'],
  ['History', 'Who led the first expedition to reach the South Pole?', 'Roald Amundsen', 'Robert Falcon Scott', 'Ernest Shackleton', 'Edmund Hillary'],
  ['Science', 'What is the largest organ of the human body?', 'The skin', 'The liver', 'The brain', 'The lungs'],
  ['Science', 'How many elements are in the periodic table?', '118', '108', '112', '126'],
  ['Science', 'Which planet has the shortest day?', 'Jupiter', 'Saturn', 'Earth', 'Mercury'],
  ['Geography', 'What is the capital of Mongolia?', 'Ulaanbaatar', 'Astana', 'Bishkek', 'Tashkent'],
  ['History', 'In which year did the Berlin Wall fall?', '1989', '1991', '1985', '1979'],
  ['Animals', 'Which is the only mammal that can truly fly?', 'The bat', 'The flying squirrel', 'The sugar glider', 'The colugo'],
  ['Music', 'Who composed The Four Seasons?', 'Antonio Vivaldi', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'George Frideric Handel'],
  ['Science', 'What is the longest bone in the human body?', 'The femur', 'The tibia', 'The humerus', 'The fibula'],
  ['Science', 'Which gas makes up most of the Sun?', 'Hydrogen', 'Helium', 'Oxygen', 'Carbon'],
  ['Science', 'How many moons does Mars have?', '2', '0', '1', '4'],
  ['History', 'Which ancient wonder stood in Alexandria?', 'The Lighthouse', 'The Colossus', 'The Hanging Gardens', 'The Mausoleum'],
  ['Geography', 'Where is the deepest point in the oceans?', 'The Mariana Trench', 'The Tonga Trench', 'The Puerto Rico Trench', 'The Java Trench'],
  ['Science', 'Roughly how fast does light travel, in kilometres per second?', '300,000', '30,000', '3,000,000', '150,000'],
  ['History', 'Who made the first successful polio vaccine?', 'Jonas Salk', 'Louis Pasteur', 'Alexander Fleming', 'Edward Jenner'],
  ['Geography', 'What is the capital of New Zealand?', 'Wellington', 'Auckland', 'Christchurch', 'Queenstown'],
  ['Science', 'What is the largest moon in the solar system?', 'Ganymede', 'Titan', 'Callisto', 'Io'],
  ['Sports', 'In which year were the first modern Olympic Games held?', '1896', '1900', '1888', '1912'],
  ['Animals', 'What is a group of crows called?', 'A murder', 'A parliament', 'A pride', 'A gaggle'],
  ['History', 'In which country is the ancient city of Petra?', 'Jordan', 'Egypt', 'Lebanon', 'Syria'],
  ['Science', 'What does DNA stand for?', 'Deoxyribonucleic acid', 'Dinitrogen acid', 'Deoxyribose nitrate', 'Dual nucleic acid'],
  ['Art', 'Who painted The Starry Night?', 'Vincent van Gogh', 'Claude Monet', 'Paul Cézanne', 'Pablo Picasso'],
  ['Sports', 'How many players does a rugby union team have on the field?', '15', '13', '11', '12'],
  ['Geography', 'Which country has the longest coastline?', 'Canada', 'Australia', 'Russia', 'Indonesia'],
  ['Science', 'At what temperature, in degrees Fahrenheit, does water boil at sea level?', '212', '200', '180', '220'],
  ['Science', 'Which planet spins on its side?', 'Uranus', 'Neptune', 'Saturn', 'Venus'],
  ['Science', "What is the most common metal in Earth's crust?", 'Aluminium', 'Iron', 'Copper', 'Calcium'],
];

const rows = (difficulty: Difficulty, list: Row[]): Question[] =>
  list.map(([category, text, correct, ...wrong]) => ({ category, text, correct, wrong, difficulty, pack: true as const }));

export const PACK: Question[] = [...rows('easy', EASY), ...rows('medium', MEDIUM), ...rows('hard', HARD)];
