-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TEACHER';

-- CreateTable
CREATE TABLE "AccessTool" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceCommand" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SignPhrase" (
    "id" TEXT NOT NULL,
    "gloss" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "videoUrl" TEXT,
    "classLevel" "ClassLevel",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignPhrase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAloud" BOOLEAN NOT NULL DEFAULT true,
    "bionicReading" BOOLEAN NOT NULL DEFAULT false,
    "dyslexiaMode" BOOLEAN NOT NULL DEFAULT false,
    "visualAlerts" BOOLEAN NOT NULL DEFAULT true,
    "gazeNavigation" BOOLEAN NOT NULL DEFAULT false,
    "voiceCommands" BOOLEAN NOT NULL DEFAULT false,
    "signInterpreter" BOOLEAN NOT NULL DEFAULT false,
    "signAvatar" BOOLEAN NOT NULL DEFAULT false,
    "speechRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessTool_slug_key" ON "AccessTool"("slug");
CREATE INDEX "SignPhrase_enabled_idx" ON "SignPhrase"("enabled");
CREATE UNIQUE INDEX "UserAccess_userId_key" ON "UserAccess"("userId");
ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AccessTool" ("id", "slug", "name", "group", "summary", "body", "enabled", "sort", "updatedAt") VALUES
('tool_read_aloud', 'read-aloud', 'Read aloud', 'Voice', 'A lesson can be spoken, with the line kept in view.', 'The student sets a speech rate. Sound still does not start until they ask for it.', true, 1, CURRENT_TIMESTAMP),
('tool_sign', 'sign-interpreter', 'Sign phrases', 'Vision', 'School signs for the words a class actually uses.', 'Each phrase has a gloss, a meaning, and an optional video. The phone app will play them later.', true, 2, CURRENT_TIMESTAMP),
('tool_avatar', 'sign-avatar', 'Sign avatar', 'Visual', 'A signer on screen for a phrase that has a video.', 'Turn this on for a student when a phrase should be shown as well as spoken.', true, 3, CURRENT_TIMESTAMP),
('tool_voice', 'voice-commands', 'Voice commands', 'Voice', 'Spoken phrases that open the next lesson, a quiz, or progress.', 'The school writes the phrase and the action. The phone app will listen for them later.', true, 4, CURRENT_TIMESTAMP),
('tool_gaze', 'gaze-navigation', 'Gaze navigation', 'Navigation', 'Move through a lesson without hands.', 'A student can turn this on. The phone app will use the camera later. Nothing is tracked on this website.', true, 5, CURRENT_TIMESTAMP),
('tool_bionic', 'bionic-reading', 'Bionic reading', 'Reading', 'The start of each word is marked so the eye can keep the line.', 'A reading aid for low vision. It does not replace the spoken lesson.', true, 6, CURRENT_TIMESTAMP),
('tool_dyslexia', 'dyslexia-mode', 'Dyslexia mode', 'Reading', 'Wider spacing and a larger type size for the lesson text.', 'The student turns it on for their own account. It does not change the class or the quiz.', true, 7, CURRENT_TIMESTAMP),
('tool_visual', 'visual-notices', 'Visual notices', 'Alerts', 'High-contrast notices for results, reminders, and plan changes.', 'The same notice is still text, so a screen reader or a braille display can read it.', true, 8, CURRENT_TIMESTAMP);

INSERT INTO "VoiceCommand" ("id", "phrase", "action", "detail", "enabled", "sort", "updatedAt") VALUES
('cmd_read', 'read this', 'read-aloud', 'Speak the lesson that is open.', true, 1, CURRENT_TIMESTAMP),
('cmd_next', 'next lesson', 'next-topic', 'Open the next topic in this subject.', true, 2, CURRENT_TIMESTAMP),
('cmd_repeat', 'repeat', 'repeat', 'Speak the last line again.', true, 3, CURRENT_TIMESTAMP),
('cmd_progress', 'my progress', 'progress', 'Open the progress for this term.', true, 4, CURRENT_TIMESTAMP);

INSERT INTO "SignPhrase" ("id", "gloss", "meaning", "enabled", "updatedAt") VALUES
('sign_school', 'SCHOOL', 'The school, or a school day.', true, CURRENT_TIMESTAMP),
('sign_maths', 'MATHEMATICS', 'The mathematics lesson.', true, CURRENT_TIMESTAMP),
('sign_listen', 'LISTEN', 'Play the spoken lesson.', true, CURRENT_TIMESTAMP),
('sign_question', 'QUESTION', 'A quiz question.', true, CURRENT_TIMESTAMP);
