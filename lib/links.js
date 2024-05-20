const { addSearchParamsToUrl } = require('./utils')

const links = ($, options) => {
  if (!options.ampDefault) {
    const linksWithDataInt = $('a[data-int]')
    linksWithDataInt.each((i, element) => {
      const link = $(element)
      const href = link.attr('href')
      const modifiedUrl = addSearchParamsToUrl(href, { amp: 1 })
      link.attr('href', modifiedUrl)
    })
  }
  return $
}

module.exports = links
