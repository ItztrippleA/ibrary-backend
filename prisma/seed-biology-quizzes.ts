import { ClassLevel, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseQuizCsv } from '../src/admin/quiz-csv';

const SUBJECT = 'Biology';

export async function seedBiologyQuizzes(prisma: PrismaClient) {
  const csvPath = join(__dirname, 'data', 'biology-sss1-quiz-bank.csv');
  const csv = readFileSync(csvPath, 'utf8');
  const { quizzes, skipped } = parseQuizCsv(csv);
  const ready = quizzes.flatMap((quiz) => {
    const classLevel = quiz.classLevel ?? ClassLevel.SS1;
    return [{ ...quiz, classLevel }];
  });

  for (const quiz of ready) {
    const years = quiz.questions.flatMap((question) => (question.year == null ? [] : [question.year]));
    const earliest = years.length ? Math.min(...years) : null;
    const latest = years.length ? Math.max(...years) : null;
    const yearLabel =
      earliest == null ? '' : earliest === latest ? `WAEC ${earliest}` : `WAEC ${earliest}–${latest}`;
    const themeMeta =
      quiz.themeNumber != null && quiz.topicNumber != null
        ? `theme:${quiz.themeNumber}|topic:${quiz.topicNumber}`
        : '';
    const description = [SUBJECT, quiz.theme, yearLabel, themeMeta].filter(Boolean).join(' · ');

    const saved = await prisma.assessment.upsert({
      where: { slug: quiz.slug },
      create: {
        slug: quiz.slug,
        title: quiz.title,
        description,
        classLevel: quiz.classLevel,
        onboarding: false,
      },
      update: {
        title: quiz.title,
        description,
        classLevel: quiz.classLevel,
      },
    });

    await prisma.question.deleteMany({ where: { assessmentId: saved.id } });
    await prisma.question.createMany({
      data: quiz.questions.map((question, index) => ({
        assessmentId: saved.id,
        prompt: question.prompt,
        options: question.options,
        correctIndex: question.correctIndex,
        order: index + 1,
      })),
    });
  }

  return {
    quizzes: ready.length,
    questions: ready.reduce((sum, quiz) => sum + quiz.questions.length, 0),
    skipped: skipped.length,
  };
}

const ranDirectly = process.argv[1]?.includes('seed-biology-quizzes');
if (ranDirectly) {
  const prisma = new PrismaClient();
  seedBiologyQuizzes(prisma)
    .then((result) => {
      console.log(
        `Seeded Biology quizzes: ${result.quizzes} topics, ${result.questions} questions (skipped ${result.skipped})`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
