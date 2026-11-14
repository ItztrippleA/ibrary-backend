import { contentIndexFromSk, parseGlossary, parseStringList, presentLesson } from './content.parse';

describe('content parse', () => {
  it('reads the lesson index from a DynamoDB sort key', () => {
    expect(contentIndexFromSk('TOPIC#01#CONTENT#0')).toBe(0);
    expect(contentIndexFromSk('TOPIC#12#CONTENT#4')).toBe(4);
  });

  it('parses JSON strings and leaves arrays alone', () => {
    expect(parseStringList('["Living things grow"]')).toEqual(['Living things grow']);
    expect(parseStringList(['Already parsed'])).toEqual(['Already parsed']);
    expect(parseGlossary('[{"term":"Cell","definition":"A unit of life"}]')).toEqual([
      { term: 'Cell', definition: 'A unit of life' },
    ]);
  });

  it('presents a lesson without leaving JSON strings for the app', () => {
    const lesson = presentLesson(
      {
        subtopic: 'Recognizing Living Things',
        curated_content_md: '# Recognizing Living Things',
        key_takeaways: '["Living things grow"]',
        glossary_terms: '[]',
        student_activities: '["Observe specimens"]',
        teacher_activities: '[]',
        accessibility_checklist: '{"captions":"required"}',
        textbook_chunk_refs: '[]',
        curriculum_unit_id: 'bio_sss1_theme1_topic1_content0',
      },
      0,
    );
    expect(lesson.contentMarkdown).toContain('Recognizing Living Things');
    expect(lesson.keyTakeaways).toEqual(['Living things grow']);
    expect(lesson.accessibilityContext).toBe('captions: required');
    expect(lesson.curriculumUnitId).toBe('bio_sss1_theme1_topic1_content0');
  });
});
