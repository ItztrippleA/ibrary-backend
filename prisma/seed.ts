import { ClassLevel, CourseStatus, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LEVELS: ClassLevel[] = [
  ClassLevel.JSS1,
  ClassLevel.JSS2,
  ClassLevel.JSS3,
  ClassLevel.SS1,
  ClassLevel.SS2,
  ClassLevel.SS3,
];

const SUBJECTS = [
  {
    slug: 'mathematics',
    name: 'Mathematics',
    description: 'Numbers, algebra, and geometry for this term.',
    durationMinutes: 240,
  },
  {
    slug: 'english',
    name: 'English Language',
    description: 'Comprehension, grammar, and essay writing.',
    durationMinutes: 200,
  },
  {
    slug: 'physics',
    name: 'Physics',
    description: 'Mechanics, waves, and electricity for the term.',
    durationMinutes: 180,
  },
  {
    slug: 'further-mathematics',
    name: 'Further Mathematics',
    description: 'Extra algebra and introductory calculus.',
    durationMinutes: 220,
  },
];

async function main() {
  for (const classLevel of LEVELS) {
    for (const term of [1, 2, 3]) {
      for (const subject of SUBJECTS) {
        await prisma.subject.upsert({
          where: {
            slug_term_classLevel: { slug: subject.slug, term, classLevel },
          },
          update: subject,
          create: { ...subject, term, classLevel },
        });
      }
    }
  }

  const maths = await prisma.subject.findUniqueOrThrow({
    where: {
      slug_term_classLevel: {
        slug: 'mathematics',
        term: 1,
        classLevel: ClassLevel.SS2,
      },
    },
  });
  const existingBooks = await prisma.book.count({ where: { subjectId: maths.id } });
  if (existingBooks === 0) {
    await prisma.book.createMany({
      data: [
        {
          subjectId: maths.id,
          title: 'New General Mathematics SS 2',
          durationMinutes: 90,
        },
        {
          subjectId: maths.id,
          title: 'Term 1 Worked Examples',
          durationMinutes: 45,
        },
      ],
    });
  }

  await prisma.plan.upsert({
    where: { code: 'monthly' },
    update: {},
    create: {
      code: 'monthly',
      name: 'Monthly',
      description: 'Billed every month. Cancel any time.',
      amountKobo: 250_000,
      intervalMonths: 1,
      promoPercent: 0,
    },
  });
  await prisma.plan.upsert({
    where: { code: 'six_month' },
    update: {},
    create: {
      code: 'six_month',
      name: '6 months',
      description: 'One payment of ₦6,000 covering six months.',
      amountKobo: 600_000,
      intervalMonths: 6,
      promoPercent: 0,
    },
  });
  await prisma.plan.upsert({
    where: { code: 'yearly' },
    update: {},
    create: {
      code: 'yearly',
      name: 'Yearly',
      description: 'A year of iBrary, with 5% off the list price.',
      amountKobo: 2_400_000,
      intervalMonths: 12,
      promoPercent: 5,
    },
  });

  const badges = [
    {
      slug: 'first-assessment',
      name: 'First Assessment',
      description: 'Completed an iBrary assessment.',
      pointsRequired: 40,
    },
    {
      slug: 'most-dedicated',
      name: 'iBrary Most Dedicated',
      description: 'Reached 500 points.',
      pointsRequired: 500,
    },
  ];
  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge,
    });
  }

  if ((await prisma.incentive.count()) === 0) {
    await prisma.incentive.createMany({
      data: [
        {
          title: 'Streak shield',
          description: 'Keep a 7-day study streak to hold your place on the leadership board.',
          pointsRequired: 70,
        },
        {
          title: 'Term closer',
          description: 'Finish every subject in a term.',
          pointsRequired: 200,
        },
      ],
    });
  }

  await prisma.assessment.upsert({
    where: { slug: 'onboarding' },
    update: {},
    create: {
      slug: 'onboarding',
      title: 'Onboarding assessment',
      description: 'Tell iBrary your class, then answer one warm-up question.',
      onboarding: true,
      questions: {
        create: [
          {
            order: 1,
            prompt: 'What class are you currently in?',
            options: LEVELS,
            correctIndex: -1,
          },
          {
            order: 2,
            prompt: 'What is your class path?',
            options: ['Science', 'Commercial', 'Arts'],
            correctIndex: -1,
          },
          {
            order: 3,
            prompt: 'Which of these is a science subject?',
            options: ['Physics', 'Commerce', 'Literature'],
            correctIndex: 0,
          },
        ],
      },
    },
  });

  await prisma.assessment.upsert({
    where: { slug: 'ss2-term-1' },
    update: {},
    create: {
      slug: 'ss2-term-1',
      title: 'SS 2 Term 1 check',
      description: 'A short check after the first term subjects.',
      classLevel: ClassLevel.SS2,
      questions: {
        create: [
          {
            order: 1,
            prompt: 'What is the value of 2 + 2 × 3?',
            options: ['12', '8', '10'],
            correctIndex: 1,
          },
          {
            order: 2,
            prompt: 'Which unit measures force?',
            options: ['Newton', 'Joule', 'Watt'],
            correctIndex: 0,
          },
        ],
      },
    },
  });

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@ibrary.app' },
    update: { role: UserRole.ADMIN },
    create: {
      email: 'admin@ibrary.app',
      passwordHash: adminPassword,
      firstName: 'iBrary',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      referralCode: 'IBADMIN',
    },
  });

  const studentPassword = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@ibrary.app' },
    update: {},
    create: {
      email: 'student@ibrary.app',
      passwordHash: studentPassword,
      firstName: 'Ada',
      lastName: 'Okoye',
      classLevel: ClassLevel.SS2,
      classPath: 'Science',
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      referralCode: 'ADAOKOYE',
      points: 120,
    },
  });

  if ((await prisma.course.count()) === 0) {
    await prisma.course.create({
      data: {
        authorId: student.id,
        title: 'SS 2 algebra drills',
        description: 'Worked examples for the first term algebra topics.',
        classLevel: ClassLevel.SS2,
        term: 1,
        status: CourseStatus.PENDING,
      },
    });
  }

  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.create({
      data: {
        title: 'Term 1 enrolment is open',
        body: 'Place this banner on the student home screen.',
        placement: 'home',
        linkUrl: 'https://ibrary.app',
      },
    });
  }

  await prisma.wallet.upsert({
    where: { userId: student.id },
    update: {},
    create: { userId: student.id, balanceKobo: 150000 },
  });

  await seedTopics();
}

async function seedTopics() {
  const biology = await prisma.subject.upsert({
    where: {
      slug_term_classLevel: { slug: 'biology', term: 1, classLevel: ClassLevel.SS1 },
    },
    update: {},
    create: {
      slug: 'biology',
      name: 'Biology',
      description: 'Cells, water, and living systems for this term.',
      durationMinutes: 180,
      term: 1,
      classLevel: ClassLevel.SS1,
    },
  });
  const maths = await prisma.subject.findUniqueOrThrow({
    where: {
      slug_term_classLevel: {
        slug: 'mathematics',
        term: 1,
        classLevel: ClassLevel.SS2,
      },
    },
  });

  const osmosis = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: biology.id, slug: 'osmosis' } },
    update: {},
    create: {
      subjectId: biology.id,
      slug: 'osmosis',
      title: 'Osmosis',
      summary: 'Water moves across a thin barrier toward the side where free water is scarcer.',
      objectives: ['Explain osmosis with a kitchen example.', 'Say what a membrane lets through.'],
      glossary: [
        { term: 'Membrane', meaning: 'A thin skin that lets some substances through and holds others back.' },
        { term: 'Free water', meaning: 'Water that is not already busy dissolving something else.' },
      ],
      sort: 0,
    },
  });
  await prisma.subtopic.upsert({
    where: { topicId_slug: { topicId: osmosis.id, slug: 'soaking-garri' } },
    update: {},
    create: {
      topicId: osmosis.id,
      slug: 'soaking-garri',
      title: 'Soaking garri',
      body: 'Dry garri swells in water because water crosses into the grain. Heat and stirring change how fast that happens, which is why the same grain behaves differently in a cold soak and in a hot bowl.',
      objectives: ['Connect osmosis to soaking garri.'],
      glossary: [{ term: 'Swelling', meaning: 'The grain taking in water and growing larger.' }],
      sort: 0,
    },
  });

  const quadratics = await prisma.topic.upsert({
    where: { subjectId_slug: { subjectId: maths.id, slug: 'quadratic-equations' } },
    update: {},
    create: {
      subjectId: maths.id,
      slug: 'quadratic-equations',
      title: 'Quadratic equations',
      summary: 'A quadratic has a squared term. Its graph is a curve, and it can cross the axis twice, once, or not at all.',
      objectives: ['Recognise a quadratic.', 'Factorise a simple quadratic.'],
      glossary: [{ term: 'Squared term', meaning: 'A term where the variable is raised to the power of two.' }],
      sort: 0,
    },
  });
  await prisma.subtopic.upsert({
    where: { topicId_slug: { topicId: quadratics.id, slug: 'factorising' } },
    update: {},
    create: {
      topicId: quadratics.id,
      slug: 'factorising',
      title: 'Factorising',
      body: 'Factorising writes a quadratic as two brackets. Each bracket is a simpler line, and the pair rebuilds the original expression.',
      objectives: ['Find two numbers that multiply and add to the right totals.'],
      glossary: [],
      sort: 0,
    },
  });

  const prompts = [
    {
      topicId: osmosis.id,
      difficulty: 'FOUNDATION' as const,
      prompt: 'Dry garri swells when it sits in water. Which idea names that movement of water?',
      options: ['Osmosis', 'Evaporation', 'Condensation'],
      correctIndex: 0,
      hint: 'Think of water crossing into the grain from the bowl, not of water turning into steam.',
    },
    {
      topicId: osmosis.id,
      difficulty: 'CORE' as const,
      prompt: 'A barrier lets water through and holds starch back. What is that barrier called?',
      options: ['A membrane', 'A solvent', 'A nucleus'],
      correctIndex: 0,
      hint: 'Look for the thin skin that chooses what may pass.',
    },
    {
      topicId: osmosis.id,
      difficulty: 'STRETCH' as const,
      prompt: 'Why can the same garri swell faster in a hot soak than in a cold one?',
      options: [
        'Heat makes the particles move faster, so water crosses sooner',
        'Heat removes the barrier',
        'Cold water has no molecules',
      ],
      correctIndex: 0,
      hint: 'The barrier is still there. Ask what heat does to how quickly particles move.',
    },
    {
      topicId: quadratics.id,
      difficulty: 'FOUNDATION' as const,
      prompt: 'Which expression is quadratic?',
      options: ['x^2 + 5x + 6', '3x + 2', '7'],
      correctIndex: 0,
      hint: 'A quadratic climbs as high as the power of two.',
    },
    {
      topicId: quadratics.id,
      difficulty: 'CORE' as const,
      prompt: 'Which pair of brackets rebuilds x^2 + 5x + 6?',
      options: ['(x + 2)(x + 3)', '(x + 1)(x + 6)', '(x + 5)(x + 6)'],
      correctIndex: 0,
      hint: 'Find two numbers that multiply to 6 and add to 5.',
    },
    {
      topicId: quadratics.id,
      difficulty: 'STRETCH' as const,
      prompt: 'A ball’s height follows a quadratic that opens downward. What does that tell you?',
      options: [
        'The height rises and then comes back down',
        'The height only increases',
        'The path is a straight line',
      ],
      correctIndex: 0,
      hint: 'Picture the curve of a throw. It does not keep climbing.',
    },
  ];

  for (const [index, prompt] of prompts.entries()) {
    const existing = await prisma.practicePrompt.findFirst({
      where: { topicId: prompt.topicId, prompt: prompt.prompt },
    });
    if (!existing) {
      await prisma.practicePrompt.create({ data: { ...prompt, sort: index } });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
