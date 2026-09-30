/* Last Call — the words. Shared line pools; incident-specific writing lives with each incident. */
(function () {
  'use strict';
  const L = (LC.Lines = {});

  /* ---------- ambient ---------- */
  L.queueChat = ['Is this the queue or just a line?', 'My feet already hurt.', 'Do I look 25?', 'Act sober. ACT SOBER.', "I'm on the list. Probably.", 'He let HER in?', 'Why is it so cold', 'Say we know the DJ.', "Don't mention the thing from last time.", 'Is it techno night? Please not techno night.', 'Stand up straight. You look drunk.', "I've been in this queue since university."];
  L.chatter = ["I'm not drunk, I'm emotionally hydrated.", 'Is this the line for the bar or the toilet?', "I love this song. What's this song?", 'Who has my phone. Oh. Hand.', 'Why is the floor sticky?', "We should do shots. Healthy shots.", "I'm going to text him. Don't let me text him.", 'This place is SO much better than last week.', 'I only came for one drink.', 'Is that the same guy from last time?', 'My shoes were a mistake.', "I've made a lot of friends tonight. None of them know it.", 'Where did Dave go?', 'Tell me I look good. Lie if you have to.', "I'm pacing myself. That's my third pace.", 'Does this count as cardio?', 'Somebody said there is a flamingo.', "I've never been here. I've been here eleven times.", "Let's find a table. Let's find a floor.", 'Is the DJ allowed to be that tall?'];
  L.chatterLate = ["I don't know where my friends are. I don't know where I am.", 'Do you think we are, like, all the same person', 'I left my jacket in 2019.', 'The music is inside my teeth.', "I'm going to start a podcast.", "Everybody here is my best friend. Except you. You're my second best friend.", 'What time is it. No. Do not tell me.', "I've lost a shoe but gained a perspective.", 'I could sleep in this chair. I could sleep in YOU.', "Is it still tonight?", 'I have ordered a kebab spiritually.', 'Who keeps moving the floor?'];
  L.smokerChat = ['I only smoke when I drink. And when I breathe.', 'Got a light?', 'This is my fourth last cigarette.', "It's freezing. I love it.", 'Tell me the gossip. Any gossip.', 'Is that guy smoking a vape or a whole trumpet?'];
  L.barCrowd = ['Excuse me. EXCUSE ME.', 'She made eye contact! She made eye contact!', "I've been here since the Roman Empire.", 'Wave a card. Wave a card, they love that.', 'Can I get a— no. Okay.'];
  L.barWait = ["I'll have the thing that's blue.", 'Two tequilas and a water. The water is a lie.', 'Surprise me. Not too much.', "Whatever's cheapest and loudest.", 'Can I start a tab? Can I start a life?'];
  L.bathQueue = ['WHAT are they DOING in there?', "It's been twenty minutes.", 'I can hear laughing. Why is there laughing?', 'Someone knock. You knock.', "I'm going to the men's. I don't care.", 'There is definitely more than one person in there.'];
  L.mirror = ['I look amazing. I look amazing?', "Who's that. Oh. It's me.", 'My face is doing something.', 'Hydration. Hydration.'];
  L.kebab = ['Best kebab of my LIFE.', "Don't tell anyone I'm eating this.", 'Chilli sauce. Everywhere. Worth it.', "It's not a kebab. It's a hug."];
  L.glassCheer = ['WAHEYYYY', 'OHHHHH', 'WAHEY!', 'SHAMEEE', 'Every time.', 'LEGEND'];
  L.sorry = ['My bad!', 'Sorry sorry sorry', 'Oops.', 'Didn\'t see you!', 'Soz'];
  L.spillSelf = ["That's fine. That was my shirt anyway.", 'Noooo my drink', 'Great. GREAT.', "It's fine. I'm fine. It's cold."];
  L.bumpMild = ['Watch it.', 'Oi.', 'Excuse YOU.', 'Wow. Okay.', 'Seriously?'];
  L.playerSpilled = ['You made me spill my drink!', 'Security spilled my drink. Unbelievable.', "That's going in the review."];
  L.playerBumped = ['Sorry, officer!', 'Hi! Hi. Not doing anything.', 'Oh— security. Okay.', 'Excuse me, big man.'];
  L.bumpSecurity = ['Sorry! Sorry.', 'My bad, boss.', 'Oh no. Not you.', "I wasn't doing anything!"];
  L.bumpSecurityDrunk = ['Heyyyy it\'s the door man!', "You're like a wall but alive.", 'Wanna dance?', "Don't throw me out, I'm DELIGHTFUL."];
  L.slipGetUp = ["I meant to do that.", 'Who put the floor there?', 'Nobody saw that.', "I'm fine. I'm totally fine.", 'Ten out of ten landing.'];
  L.afterVomit = ["I'm good now.", 'That was the tequila.', 'Better out than in.', "Don't tell my mum.", 'I feel reborn.', 'Who ordered that.'];

  /* ---------- staff ---------- */
  L.bartender = ['Next!', 'Cash or card?', "That's not a drink, that's a cry for help.", 'No, we do not do "something fun".', "I don't care what they gave you last time."];
  L.marcusAdmit = ['Go on.', 'In you go.', 'Have a good night.', 'Behave.'];
  L.marcusDeny = ['Not tonight.', "Nah. You're done.", 'Not in those shoes.', 'Try again next week.', "You can't stand up. That's a no."];
  L.backupArrive = ['Got him.', "I'm here. What's he done?", 'Other arm. Go.', 'Evening, sunshine.'];
  L.policeArrive = ['Police are here. Somebody made a phone call.', 'Blue lights out front. Great.'];
  L.policeLine = ['Evening. Who wants to explain this?', 'Right. Everybody calm down.', 'Again? It\'s Thursday.', "We're going to need you to come with us."];

  /* ---------- arguments ---------- */
  L.argueOpen = ['WHAT did you just say?', 'Are you STARING at me?', 'Did you just push me?', 'Do you have a problem?', "You're in my SPACE, mate.", "That's my spot."];
  L.argueSpillOpen = ['You spilled my DRINK!', 'That was a FULL drink!', 'You owe me a drink.', 'Look at my SHIRT.'];
  L.argue = ["I didn't say ANYTHING.", 'YOU walked into ME.', 'Do you know how much that was?', "You're unbelievable.", 'Say it again. Say it.', "I'm not even talking to you.", 'Whatever, man.', 'It was ALREADY spilled.'];
  L.argueHot = ["Step outside then!", 'Come on then!', "You want to go? Let's go!", "Hold my drink.", "I'm not scared of you!", 'Try it!'];
  L.argueSupport = ['Yeah! Tell him!', "Don't let him talk to you like that!", 'He always does this!', "Leave it. No, don't leave it!"];
  L.argueJoinFriend = ["What's going on? Who is this?", "Is he bothering you?", "Oi. That's my mate."];
  L.argueRandomJoin = ['Yeah! ...what are we arguing about?', "I'm with HIM. Who is he?", "I don't know what's happening but I'm FURIOUS.", 'Somebody owes somebody a drink!', 'I heard what you said! What did you say?'];
  L.argueRandom = ['Yeah!', 'Unbelievable!', "That's what I said!", 'Somebody call someone!', "I'm on everyone's side!"];
  L.peacemaker = ['Guys. Guys.', "It's not worth it!", "Let's just go dance.", 'Everybody take a breath.', 'Leave it, babe, leave it.', 'We came here to have FUN.'];

  /* ---------- fights ---------- */
  L.fightShout = ["COME ON THEN!", 'Is that all you got?', 'Get OFF me!', 'My jacket! Mind the jacket!', "You're DEAD!", 'Somebody hold me back! Why is nobody holding me back?'];
  L.fightMiss = ['Missed on purpose.', 'Stand STILL!', "Who moved?"];
  L.fightBystanderJoin = ["Who hit me?! Right!", "OKAY. Okay. I'm in.", "That's it!"];
  L.fightBystanderHurt = ['OW! I was just standing here!', 'My drink! My FACE!', 'Why?!'];
  L.fightChant = ['FIGHT! FIGHT! FIGHT!', 'OHHHHH', 'Get him!', "I'm filming, I'm filming", 'This is going on the group chat', 'WORLDSTAR'];

  /* ---------- escorts ---------- */
  L.friendComplain = ["He didn't even DO anything!", "You can't do this!", 'This is discrimination! Against idiots!', "We're regulars!", "I'm filming this.", 'He was dancing! DANCING!', "Where are you taking him? He's got my keys!"];
  L.friendTug = ['Give him BACK!', "He's with us!", 'Let GO of him!'];
  L.friendLeaveToo = ['If he goes, we go.', "Fine! This place is rubbish anyway!", 'Solidarity!', "Wait for me, I'm his ride."];
  L.congaJoin = ['CONGAAAA!', "Ooh, where are we going?", 'Is it a conga? It is now!', 'NOBODY TELL ME WHERE WE ARE GOING'];
  L.congaChant = ['Da da da da da da DA', 'CONGA!', 'Left, right, left!', 'Choo choo!'];
  L.congaConfused = ['...wait. Where are we?', 'Why is it cold?', 'Is this the smoking area?', 'Did the conga just leave the building?', "Hang on. We're outside."];

  // ejection reactions: start = when grabbed, during = while being moved, out = when outside
  L.ej = {
    peaceful: { start: ['Fine. FINE.', "I'm going, I'm going.", 'Okay, okay, hands off the jacket.'], during: ['This is so embarrassing.', "I was leaving anyway.", 'Can I at least finish my drink?'], out: ['Fine! Your music is rubbish anyway.', "I'm getting a kebab. Out of spite."] },
    argue: { start: ['For WHAT?!', 'What did I do?!', "You can't touch me!"], during: ['This is assault! Friendly assault!', "I know my rights! I don't know them, but I know I have them!", "I'm a paying customer!", 'Where is your MANAGER?'], out: ["I'll be back! With a different jacket!", 'One star!', "I'm calling Trustpilot!"] },
    dragFeet: { start: ["I'm not going.", 'Nope. Nope.'], during: ["I'm going... I'm going... (not going)", "My legs don't work anymore.", 'My shoes are glued to this floor. Literally.'], out: ['Well. That was undignified.'] },
    grabber: { start: ["You'll never take me alive!", 'NO!'], during: ['I LIVE HERE NOW!', "I'm part of the furniture!", "This is my chair. We're together."], out: ['I will remember this door.'] },
    runner: { start: ['Ha! Nope!'], during: ["Can't catch me!", 'Parkour!'], out: ['Worth it.'] },
    hider: { start: ['Guys! GUYS! Hide me!'], during: ['Nobody saw me.'], out: ['Tell my friends I was brave.'] },
    negotiator: { start: ['Okay, okay. Let\'s talk about this.'], during: ['What if I leave in ten minutes?', 'What if I just stand very still?', 'Five minutes. Four. Final offer.'], out: ['Worst negotiation of my life.'] },
    owner: { start: ['Do you know who I am? I know the OWNER.'], during: ['Me and the owner are like THIS.', "He'll hear about this!"], out: ['The owner will... he will... is it Greg?'] },
    briber: { start: ['Okay. Twenty quid and this never happened.'], during: ['Thirty. Final offer.', "Everybody has a price. What's yours? Is it thirty?"], out: ['You just turned down THIRTY POUNDS.'] },
    crier: { start: ['*sob*', "I'm having a really hard night!"], during: ['*loud sobbing*', "He doesn't even like me!", 'Everyone is looking at me!'], out: ['*sniff* ...is there a taxi?'] },
    polite: { start: ['Of course. Right away, officer.', 'Absolutely. My apologies.'], during: ['Lovely evening, officer.', 'Mind the step. Oh, you know. Of course you know.', 'Thank you so much for your service.'], out: ['Thank you. Truly. Goodnight.'] },
    noEnglish: { start: ['No English.', 'No speak. Sorry. No.'], during: ['...no English.', '*nods politely*'], out: ['This is an absolute outrage and I will be writing to the council.'] },
    filmer: { start: ['Oh, you want to do this ON CAMERA?', "Chat, look at this. Chat."], during: ["Chat, security is being SO aggressive right now.", "Say hi to my 312 followers.", 'This is going on my story.'], out: ['Chat, I\'ve been cancelled by a nightclub.'] },
    fighter: { start: ["Get your hands OFF me!", 'Right. RIGHT.'], during: ['Let me GO!', "I'll have you!", 'Come ON then!'], out: ["This isn't over!"] },
    limp: { start: ['*goes completely limp*'], during: ['*dead weight*', '...', 'I am a puddle now.'], out: ['*stays lying on the pavement*'] },
    father: { start: ['Do you know who my FATHER is?'], during: ['My father will hear about this!', 'My father has a BOAT.'], out: ["I'm calling him! ...he doesn't pick up."] },
  };

  /* ---------- player ---------- */
  L.mutterNotice = ['...what is that guy doing?', 'Wait. What?', 'Oh, come on.', 'Why.', 'Every single week.', 'Absolutely not.', "Nope. That's a no.", 'You have got to be kidding.', 'Great.', '...seriously?'];
  L.mutterCrash = ['...great.', 'What was that.', "That'll be mine, then.", 'Brilliant.', 'Sounded expensive.'];
  L.mutterIdle = ['Seven more hours.', 'I could be asleep.', 'Why do I do this.', 'This is fine.', 'Deep breaths.', 'Nobody pays me enough for this.'];
  L.mutterSlip = ['Nope.', 'Not today.', 'Who mopped— oh. Me. I mopped.'];
  L.stareNormal = ['...can I help you?', 'Why is security staring at me?', "I'm not doing anything!", 'Is there something on my face?', '...hi?', "Okay. I'll go over there."];
  L.stareSelfConscious = ['I swear I paid.', 'Is this about the thing?', 'I\'ll go. I\'ll just go.'];
  L.shove = ['Move.', 'Coming through.', 'Excuse me. Security.', 'Out of the way.'];
  L.shoveReact = ['Hey!', 'Rude!', 'Okay! Okay!', 'Whoa!'];
  L.innocentGrab = ['WHAT did I do?!', "I haven't DONE anything!", "I literally just got here!", 'Is this a prank?'];

  L.objectiveSubs = ['Apparently this is your problem now.', 'Nobody else is going to do it.', 'This is why they pay you. Barely.', 'Deep breath.', 'It is, in fact, your job.', 'Well. Go on then.'];

  /* ---------- small talk (player options) ---------- */
  L.talkNormal = [
    { npc: ['Heyyyy.', 'Oh. Hi. Am I in trouble?', 'Great night, right?', 'Are you a real bouncer?', 'Is the DJ taking requests?', "I'm being SO good tonight."] },
  ];
  L.normalReplies = {
    evening: ['Evening!', 'Hi!', 'Nice jacket.'],
    alright: ["I'm great! I'm the best!", 'Never better.', "I'm... yeah. Yeah!", 'I think I need water. Is that bad?'],
    water: ['Water? What am I, a plant?', 'Fine. Fine.', 'Ooh. Hydration.'],
    out: ["What?! What did I do?", "You can't just— can you just?"],
  };

  /* ---------- radio chatter (speaker, line) ---------- */
  L.radioIdle = [
    [['marcus', 'Unit Four, radio check.'], ['you', 'Loud and clear.'], ['marcus', 'Good. It gets worse from here.']],
    [['jolene', 'Security.'], ['you', 'Yeah?'], ['jolene', 'Someone ordered twelve waters.'], ['you', 'So?'], ['jolene', "They haven't paid for any of the other drinks."]],
    [['krank', 'Is anyone else hearing a squeak in the left monitor?'], ['marcus', 'That was the manager.']],
    [['petrakis', 'Who put a traffic cone in the staff fridge?'], ['marcus', 'Define "put".']],
    [['marcus', 'Unit Four, reminder. The wet floor signs are not decorations.'], ['you', 'They are tonight.']],
    [['jolene', 'We are out of limes.'], ['marcus', 'How.'], ['jolene', 'Someone ate them. Like apples.']],
    [['ines', 'Coat check. Somebody handed me a live goldfish.'], ['marcus', 'Is it wearing a coat?'], ['ines', '...no.'], ['marcus', 'Then it is not our problem.']],
    [['krank', 'Guy just asked me to play "the song that goes like this". He hummed nothing.']],
    [['petrakis', 'The flamingo is looking at me.'], ['marcus', 'It does that.']],
    [['marcus', "Queue is round the corner. Somebody is selling hot dogs in it."], ['you', 'Are they good?'], ['marcus', 'Unit Four.']],
    [['priya', "Tank, where are you?"], ['tank', 'Kebab van.'], ['priya', 'On shift?'], ['tank', 'On a kebab.']],
    [['jolene', 'A woman just paid for her drink in coins. Foreign coins. Some of them were buttons.']],
    [['rico', 'VIP has a man who says he is "the VIP of VIP".'], ['marcus', 'Is he?'], ['rico', 'He is wearing a sash he made himself.']],
    [['ines', 'Somebody checked a coat, came back, checked the same coat again.'], ['marcus', 'Same ticket?'], ['ines', 'Different person.']],
    [['krank', 'Crowd is good tonight.'], ['marcus', "Don't say that."], ['krank', 'Why?'], ['marcus', 'Because now it is going to happen.']],
    [['bogdan', 'Kitchen here. Someone ordered chips with no chips.'], ['marcus', 'So nothing.'], ['bogdan', 'I gave him the plate.']],
    [['petrakis', 'Why is there a shoe in the ice machine?'], ['jolene', "Which ice machine?"], ['petrakis', 'There are MORE?']],
    [['marcus', 'Unit Four, how is the floor?'], ['you', 'Sticky.'], ['marcus', 'Morally or physically?'], ['you', 'Yes.']],
  ];
  L.radioLate = [
    [['marcus', "It's three in the morning. Everyone is a philosopher now."], ['you', 'I noticed.']],
    [['jolene', "Man at the bar asked if we do breakfast."], ['marcus', 'Do we?'], ['jolene', "He's eating the olives."]],
    [['krank', "Should I play the slow one?"], ['marcus', "Not yet. They're still vertical."]],
    [['ines', 'Somebody is asleep in the coats.'], ['marcus', 'Is it a coat?'], ['ines', "It's snoring."]],
    [['petrakis', 'How many people are inside?'], ['marcus', 'Too many.'], ['petrakis', 'How many is too many?'], ['marcus', 'All of them.']],
    [['priya', 'Found a phone in the urinal.'], ['marcus', 'Is it working?'], ['priya', "It's ringing. It says 'MUM'."]],
  ];
  // reports that point at a room without saying what is there
  L.radioReport = {
    mens: [[['marcus', "Can you check the men's bathroom?"], ['you', 'Why?'], ['marcus', "...you'll see."]]],
    womens: [[['priya', "Unit Four, women's toilets. I'm not going in there again."], ['you', 'What is it?'], ['priya', 'Just go.']]],
    dance: [[['krank', 'Security, dance floor. Something is happening near my speakers.'], ['you', 'Something?'], ['krank', 'Something.']]],
    dj: [[['krank', 'SECURITY. There is a MAN. In my BOOTH.']]],
    bar: [[['jolene', 'Security to the bar, please.'], ['you', 'What is it?'], ['jolene', "I don't have the words."]]],
    vip: [[['rico', 'VIP has a situation.'], ['you', 'What kind?'], ['rico', 'The kind where I call you.']]],
    lobby: [[['ines', "Coat check here. Something's going on in the lobby."]]],
    patio: [[['marcus', 'Smoking area, Unit Four. Take a look.']]],
    hall: [[['marcus', 'Main floor, Unit Four. Keep your eyes open.']]],
    lounge: [[['marcus', 'Booths. Somebody check the booths.']]],
    chill: [[['marcus', "Chill-out room. It's not very chill."]]],
    kitchen: [[['bogdan', 'There is a man in my kitchen. He is eating the garnish.']]],
    backstage: [[['petrakis', 'There is someone backstage who is not staff. Or dressed as staff. Badly.']]],
    street: [[['marcus', 'Front door. Come have a look at this.']]],
    parking: [[['marcus', 'Car park. I can see it from here. Go.']]],
    alley: [[['marcus', 'Alley. Somebody is doing something in the alley.'], ['you', 'Something?'], ['marcus', 'Alley things.']]],
    bathhall: [[['marcus', 'Toilet corridor. Heads up.']]],
    office: [[['petrakis', 'WHY is there someone in my OFFICE?']]],
  };

  /* ---------- closing ---------- */
  L.lightsOnReact = ['AWWWW', 'Nooo', 'My eyes!', 'Who turned the sun on?', "It's so bright", 'Is it morning?', 'Oh no. Oh no, look at everything.', 'I look like this?', 'Why is the floor like that'];
  L.herdStare = ['OKAY. Okay. We\'re going.', 'Alright, alright, Gandalf.', 'Is that a torch? Rude.', "We're going! God.", '...fine.'];
  L.herdFollow = ['Come on. The lights are on.', "Babe. BABE. We're going.", 'Where are my shoes. Found them. Going.', 'Afterparty at Dean\'s!', 'Is Dean even here?', 'Bye flamingo!'];
  L.closingAsk = ['Can you put the music back on?', 'One more song!', 'Is there an afterparty?', "We just got here!", 'Can I just finish this?', 'Where are we going next?', 'Have you seen my friend?'];
  L.closingPlayer = ["Party's over.", 'Time to go.', 'Lights are on. That means home.', 'Out. Everyone. Out.', "Club's closed."];

  /* ---------- lost & found ---------- */
  L.lostAsk = { shoe: ['Have you seen a shoe? It looks like this one.', "I've lost a shoe. It was on my foot."], jacket: ['Have you seen my jacket? It\'s jacket-coloured.', "I've lost my jacket. Again."], phone: ['Has anyone seen my phone?!', 'Somebody STOLE my phone!'], friend: ['Have you seen Dave?', "I can't find Dave. He's tall. Or short."] };
  L.lostThanks = ['YOU FOUND IT!', 'I love you. Not like that. Like that a bit.', 'Security is my new best friend.', 'Faith in humanity: restored. Slightly.'];
})();
