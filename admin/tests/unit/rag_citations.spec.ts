import { test } from '@japa/runner'
import {
  buildKiwixCitationUrl,
  buildRagCitations,
  getKiwixZimName,
} from '../../app/utils/rag_citations.js'

test.group('RAG citations', () => {
  test('builds a Kiwix page link with a section anchor', ({ assert }) => {
    assert.equal(
      getKiwixZimName('/storage/zim/Wikipedia English+2026-01.zim'),
      'wikipedia_englishplus2026-01'
    )
    assert.equal(
      buildKiwixCitationUrl(
        'http://localhost:8090',
        '/storage/zim/Wikipedia English+2026-01.zim',
        'Emergency/Water purification',
        'Methods of purification'
      ),
      'http://localhost:8090/content/wikipedia_englishplus2026-01/Emergency/Water%20purification#Methods%20of%20purification'
    )
  })

  test('deduplicates retrieved chunks and keeps non-ZIM sources unlinked', ({ assert }) => {
    const citations = buildRagCitations(
      [
        {
          text: 'first chunk',
          score: 0.9,
          metadata: {
            content_type: 'zim_article',
            source: '/storage/zim/medicine.zim',
            article_title: 'Water safety',
            article_path: 'Water safety',
            section_title: 'Boiling',
          },
        },
        {
          text: 'duplicate chunk',
          score: 0.8,
          metadata: {
            content_type: 'zim_article',
            source: '/storage/zim/medicine.zim',
            article_title: 'Water safety',
            article_path: 'Water safety',
            section_title: 'Boiling',
          },
        },
        {
          text: 'uploaded notes',
          score: 0.7,
          metadata: { source: 'storage/kb_uploads/notes.txt', content_type: 'text' },
        },
      ],
      'http://localhost:8090'
    )

    assert.lengthOf(citations, 2)
    assert.equal(citations[0].url, 'http://localhost:8090/content/medicine/Water%20safety')
    assert.isUndefined(citations[1].url)
    assert.equal(citations[1].source, 'notes.txt')
  })
})
