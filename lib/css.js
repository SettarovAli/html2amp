const CleanCss = require('clean-css')
const cheerio = require('cheerio')
const { PurgeCSS } = require('purgecss')
const utils = require('./utils')

const minifyCssVariables = (cssString) => {
  const variableMapping = {}
  const variablePattern = /--[\w-]+/g
  let minifiedNameCounter = 0

  return cssString.replace(variablePattern, (variableName) => {
    if (!(variableName in variableMapping)) {
      const minifiedName = `--${minifiedNameCounter++}`
      variableMapping[variableName] = minifiedName
    }
    return variableMapping[variableName]
  })
}

const purgeCss = async ($, cssString) => {
  const purgeCSSResult = await new PurgeCSS().purge({
    content: [
      {
        raw: $.html(),
        extension: 'html',
      },
    ],
    css: [{ raw: cssString }],
    safelist: {
      standard: ['html[amp]'],
      greedy: [/^amp-.*/],
    },
  })
  return purgeCSSResult[0].css
}

const minifyCss = async ($, cssString) => {
  const purgedCss = await purgeCss($, cssString)
  return minifyCssVariables(purgedCss)
}

const build = (styles) => {
  const cssString = styles.map((style) => new CleanCss().minify(style).styles).join('')
  return cssString.replace(/!important/g, '')
}

const callbacks = (elementString, cssText, options = {}) => {
  const plugins = options.cssPlugins || []
  return plugins.reduce((css, plugin) => {
    return plugin(elementString, css, options)
  }, cssText)
}

const css = async ($, options) => {
  const styleSheetElements = $('link[rel="stylesheet"]')
  const styleElements = $('style')
  const urlElms = Array.from(styleSheetElements).map((node, _i) => {
    const $element = cheerio.load(node)
    return {
      url: utils.normalizeUrl($(node).attr('href')),
      element: $element.html(),
    }
  })
  const styles = urlElms.map(async ({ url, elementString }) => {
    if (url.startsWith('http')) {
      const text = await utils.getRemoteFile(url, options.basicAuth)
      return callbacks(elementString, text, options)
    } else {
      const text = utils.getRelativeFile(url, options.cwd)
      return callbacks(elementString, text, options)
    }
  })
  const texts = await Promise.all(styles)
  styleElements.each((i, element) => {
    const $element = cheerio.load(element)
    texts.push(callbacks($element.html(), $(element).html(), options))
  })
  const cssString = build(texts)
  const minifiedCss = await minifyCss($, cssString)
  $('head').append(`<style amp-custom>${minifiedCss}</style>`)
  styleSheetElements.remove()
  styleElements.remove()
  return $
}

module.exports = css
