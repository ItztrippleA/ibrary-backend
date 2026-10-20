-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('FOUNDATION', 'CORE', 'STRETCH');
CREATE TYPE "PodcastStatus" AS ENUM ('QUEUED', 'SCRIPTING', 'VOICING', 'READY', 'FAILED');
CREATE TYPE "ScriptSource" AS ENUM ('LESSON', 'OPENAI');
CREATE TYPE "VoiceSource" AS ENUM ('NONE', 'SYSTEM', 'OPENAI');

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives" TEXT[],
    "glossary" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subtopic" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "objectives" TEXT[],
    "glossary" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Subtopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subtopicId" TEXT,
    "targetKey" TEXT NOT NULL,
    "focusHash" TEXT NOT NULL,
    "focus" TEXT NOT NULL DEFAULT '',
    "status" "PodcastStatus" NOT NULL DEFAULT 'QUEUED',
    "script" JSONB NOT NULL,
    "scriptSource" "ScriptSource" NOT NULL DEFAULT 'LESSON',
    "voiceSource" "VoiceSource" NOT NULL DEFAULT 'NONE',
    "audioKey" TEXT,
    "audioUrl" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticePrompt" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "difficulty" "SkillLevel" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "hint" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PracticePrompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearnerState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "incorrect" INTEGER NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER,
    "competency" INTEGER NOT NULL DEFAULT 50,
    "skill" "SkillLevel" NOT NULL DEFAULT 'CORE',
    "streakWrong" INTEGER NOT NULL DEFAULT 0,
    "completion" INTEGER NOT NULL DEFAULT 0,
    "lastMiss" TEXT,
    "answeredIds" TEXT[],
    "correctIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "Topic"("subjectId", "slug");
CREATE INDEX "Topic_subjectId_sort_idx" ON "Topic"("subjectId", "sort");
CREATE UNIQUE INDEX "Subtopic_topicId_slug_key" ON "Subtopic"("topicId", "slug");
CREATE INDEX "Subtopic_topicId_sort_idx" ON "Subtopic"("topicId", "sort");
CREATE UNIQUE INDEX "Podcast_targetKey_focusHash_key" ON "Podcast"("targetKey", "focusHash");
CREATE INDEX "Podcast_topicId_createdAt_idx" ON "Podcast"("topicId", "createdAt");
CREATE INDEX "PracticePrompt_topicId_difficulty_idx" ON "PracticePrompt"("topicId", "difficulty");
CREATE UNIQUE INDEX "LearnerState_userId_topicId_key" ON "LearnerState"("userId", "topicId");
CREATE INDEX "LearnerState_competency_idx" ON "LearnerState"("competency");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtopic" ADD CONSTRAINT "Subtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PracticePrompt" ADD CONSTRAINT "PracticePrompt_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnerState" ADD CONSTRAINT "LearnerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnerState" ADD CONSTRAINT "LearnerState_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
