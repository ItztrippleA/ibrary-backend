import {
  contentIndexFromItem,
  contentIndexFromSk,
  contentIndexFromUnitId,
  parseGlossary,
  parseStringList,
  presentImages,
  presentLesson,
  presentSummary,
  presentTopic,
} from './content.parse';

describe('content parse', () => {
  it('reads the lesson index from a DynamoDB sort key', () => {
    expect(contentIndexFromSk('TOPIC#01#CONTENT#0')).toBe(0);
    expect(contentIndexFromSk('TOPIC#12#CONTENT#4')).toBe(4);
  });

  it('reads content_index from curriculum_unit_id', () => {
    expect(contentIndexFromUnitId('bio_sss1_theme1_topic1_content0')).toBe(0);
    expect(contentIndexFromUnitId('bio_sss1_theme1_topic1_content3')).toBe(3);
    expect(contentIndexFromItem({ curriculum_unit_id: 'bio_sss1_theme1_topic2_content2' })).toBe(2);
    expect(contentIndexFromItem({ SK: 'TOPIC#01#CONTENT#1' })).toBe(1);
  });

  it('parses JSON strings and leaves arrays alone', () => {
    expect(parseStringList('["Living things grow"]')).toEqual(['Living things grow']);
    expect(parseStringList(['Already parsed'])).toEqual(['Already parsed']);
    expect(parseGlossary('[{"term":"Cell","definition":"A unit of life"}]')).toEqual([
      { term: 'Cell', definition: 'A unit of life' },
    ]);
    expect(parseGlossary('{"Cell":"A unit of life"}')).toEqual([{ term: 'Cell', definition: 'A unit of life' }]);
  });

  it('prefers the short topic title from the content API', () => {
    const topic = presentTopic({
      topic_number: 1,
      topic: 'Characteristics of living things',
      title: 'Characteristics of Living Things',
      learning_objectives: '["Describe what is meant by a living thing"]',
      glossary_terms: '{}',
    });
    expect(topic.title).toBe('Characteristics of Living Things');
    expect(topic.description).toBe('Characteristics of living things');
  });

  it('uses SK as the primary lesson id', () => {
    const summary = presentSummary({
      subtopic: 'Characteristics of living things',
      SK: 'TOPIC#01#CONTENT#0',
      PK: 'same-for-whole-theme',
    });
    expect(summary.sk).toBe('TOPIC#01#CONTENT#0');
    expect(summary.contentIndex).toBe(0);
  });

  it('presents a lesson without leaving JSON strings for the app', () => {
    const lesson = presentLesson(
      {
        SK: 'TOPIC#01#CONTENT#0',
        subtopic: 'Recognizing Living Things',
        curated_content_md: '# Recognizing Living Things',
        key_takeaways: '["Living things grow"]',
        glossary_terms: '[]',
        student_activities: '["Observe specimens"]',
        teacher_activities: '[]',
        accessibility_checklist: '{"captions":"required"}',
        textbook_chunk_refs: '[]',
        curriculum_unit_id: 'bio_sss1_theme1_topic1_content0',
        images: [
          {
            image_id: 'fig1',
            url: 'https://example.com/fig1.jpeg',
            caption: 'A cell',
            alt_text: 'Diagram of a cell',
          },
          {
            image_id: 'private',
            s3_url: 's3://bucket/private.jpeg',
            caption: 'Hidden',
            alt_text: 'Should be dropped',
          },
        ],
      },
      0,
    );
    expect(lesson.sk).toBe('TOPIC#01#CONTENT#0');
    expect(lesson.contentMarkdown).toContain('Recognizing Living Things');
    expect(lesson.keyTakeaways).toEqual(['Living things grow']);
    expect(lesson.accessibilityContext).toBe('captions: required');
    expect(lesson.curriculumUnitId).toBe('bio_sss1_theme1_topic1_content0');
    expect(lesson.images).toEqual([
      { id: 'fig1', url: 'https://example.com/fig1.jpeg', caption: 'A cell', altText: 'Diagram of a cell' },
    ]);
  });

  it('rewrites published s3 image urls and keeps https urls', () => {
    expect(
      presentImages([
        { image_id: 'a', url: 'https://cdn.example/a.png', caption: 'A', alt_text: 'A' },
        {
          image_id: 'b',
          s3_url: 's3://ibrary-content/biology/textbook-images/bio2e_ch1_sec2_pg44_img0.jpeg',
          caption: 'B',
          alt_text: 'B',
        },
        { image_id: 'c', s3_url: 's3://other-bucket/c.png', caption: 'C', alt_text: 'C' },
      ]),
    ).toEqual([
      { id: 'a', url: 'https://cdn.example/a.png', caption: 'A', altText: 'A' },
      {
        id: 'b',
        url: 'https://lajxoepgscwdsqbipeyt.supabase.co/storage/v1/object/public/ibrary-content/biology/textbook-images/bio2e_ch1_sec2_pg44_img0.jpeg',
        caption: 'B',
        altText: 'B',
      },
    ]);
  });

  it('maps list-subtopics rows by SK when PK is shared', () => {
    const first = presentLesson({
      PK: 'b41976e0-6b3d-b14f-aa3f-f4198da06ca1',
      SK: 'TOPIC#01#CONTENT#0',
      subtopic: 'Characteristics of living things',
      curated_content_md: '## Intro',
      key_takeaways: '[]',
      glossary_terms: '{}',
      student_activities: '[]',
      teacher_activities: '[]',
      accessibility_checklist: '[]',
      textbook_chunk_refs: '[]',
      curriculum_unit_id: 'bio_sss1_theme1_topic1_content0',
    });
    const second = presentLesson({
      PK: 'b41976e0-6b3d-b14f-aa3f-f4198da06ca1',
      SK: 'TOPIC#01#CONTENT#1',
      subtopic: 'Differences between plants and animals',
      curated_content_md: '## Intro',
      key_takeaways: '[]',
      glossary_terms: '{}',
      student_activities: '[]',
      teacher_activities: '[]',
      accessibility_checklist: '[]',
      textbook_chunk_refs: '[]',
      curriculum_unit_id: 'bio_sss1_theme1_topic1_content1',
    });
    expect(first.sk).toBe('TOPIC#01#CONTENT#0');
    expect(second.sk).toBe('TOPIC#01#CONTENT#1');
    expect(first.sk).not.toBe(second.sk);
    expect(first.contentIndex).toBe(0);
    expect(second.contentIndex).toBe(1);
  });
});
