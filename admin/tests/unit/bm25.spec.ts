import { test } from '@japa/runner'
import { rankBM25 } from '../../app/utils/bm25.js'

test.group('BM25 ranking', () => {
  test('ranks an exact title and term match above a broad match', ({ assert }) => {
    const results = rankBM25(
      [
        { id: 'broad', title: 'Emergency preparedness', text: 'A general guide to getting ready.' },
        {
          id: 'exact',
          title: 'Solar power for beginners',
          text: 'Build a solar power system for an offline home.',
        },
      ],
      'solar power',
      2
    )

    assert.equal(results[0].id, 'exact')
    assert.isAbove(results[0].score, results[1].score)
  })
})
