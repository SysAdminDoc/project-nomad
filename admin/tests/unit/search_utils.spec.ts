import { test } from '@japa/runner'
import { parseHtmlSearchResults, parseStructuredSearchResults } from '../../app/utils/search.js'

test.group('search result parsing', () => {
  test('normalizes nested JSON result collections', ({ assert }) => {
    const results = parseStructuredSearchResults(
      JSON.stringify({
        data: {
          results: [
            {
              id: 1,
              title: 'Offline First Aid',
              summary: '<b>Practical guidance</b>',
              href: '/content/first-aid',
            },
          ],
        },
      }),
      'http://localhost:8090',
      5
    )

    assert.lengthOf(results, 1)
    assert.equal(results[0].title, 'Offline First Aid')
    assert.equal(results[0].snippet, 'Practical guidance')
    assert.equal(results[0].url, 'http://localhost:8090/content/first-aid')
  })

  test('extracts article links from HTML responses', ({ assert }) => {
    const results = parseHtmlSearchResults(
      '<main><article class="search-result"><a href="/content/book/solar">Solar Power</a><p>Build an offline power system.</p></article></main>',
      'http://localhost:8090',
      5
    )

    assert.lengthOf(results, 1)
    assert.equal(results[0].title, 'Solar Power')
    assert.equal(results[0].snippet, 'Build an offline power system.')
  })
})
