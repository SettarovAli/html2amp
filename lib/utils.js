const axios = require('axios')
const fs = require('fs')
const path = require('path')
const uriToBuffer = require('data-uri-to-buffer')
const probe = require('probe-image-size')

const getHeaders = (basicAuth) => ({
  ...(basicAuth && {
    Authorization: `Basic ${Buffer.from(basicAuth, 'utf-8').toString('base64')}`,
  }),
})

const addSearchParamsToUrl = (inputUrl, params) => {
  const url = new URL(inputUrl)
  const existingParams = new URLSearchParams(url.search)
  Object.keys(params).forEach((param) => {
    existingParams.set(param, params[param])
  })
  url.search = existingParams.toString()
  return url.toString()
}

const normalizeUrl = (url) => {
  if (url.startsWith('http')) {
    return url
  } else if (url.startsWith('//')) {
    return `https:${url}`
  } else if (url.startsWith('data:')) {
    return url
  } else {
    // relative file path excluding query parameters and hash
    return url.split('?')[0].split('#')[0]
  }
}

const remoteFileCaches = new Map()
async function getRemoteFile(url, basicAuth) {
  try {
    if (remoteFileCaches.has(url)) return remoteFileCaches.get(url)
    const file = await axios
      .get(url, {
        headers: getHeaders(basicAuth),
      })
      .then((response) => response.data)
    remoteFileCaches.set(url, file)
    return file
  } catch (ignoreErr) {
    console.error(`Fetching ${url} failed.`)
  }
}

const getRelativeFile = (url, cwd) => {
  const filePath = path.join(cwd, url)
  try {
    if (fs.existsSync(filePath)) {
      return String(fs.readFileSync(filePath))
    } else {
      throw new Error()
    }
  } catch (ignoreErr) {
    console.error(`Reading ${filePath} failed.`)
  }
}

const normalizeSrc = (src, srcset) => {
  if (src) return src
  const set = srcset.split(',')[0]
  return set.split(' ')[0]
}

const remoteImgCaches = new Map()
const srcNode = async (cwd, attributes, basicAuth) => {
  const { src, alt = '', ...attrs } = attributes
  const url = normalizeUrl(normalizeSrc(src, attributes.srcset))
  let size = { width: null, height: null }
  let result = null
  if (url.startsWith('http')) {
    if (remoteImgCaches.has(url)) {
      result = remoteImgCaches.get(url)
      size = { width: result.width, height: result.height }
    } else {
      try {
        result = await probe(url, {
          headers: getHeaders(basicAuth),
        })
        remoteImgCaches.set(url, result)
        size = { width: result.width, height: result.height }
      } catch (ignoreErr) {
        console.log(`Invalid Asset, Skipping.... (${url})`)
      }
    }
  } else if (url.startsWith('data:')) {
    const buffer = uriToBuffer(url)
    result = probe.sync(buffer)
    size = { width: result.width, height: result.height }
  } else {
    const fileStream = fs.createReadStream(path.join(cwd, url))
    result = await probe(fileStream)
    size = { width: result.width, height: result.height }
    fileStream.destroy()
  }
  if (result !== null) {
    // remove loading, type attributes (#80, #104)
    let { loading, type, width, height, class: className, ..._attrs } = attrs
    const imgWidth = width || size.width
    const isEditorImg = className?.includes('editor-img')
    const layout = isEditorImg && imgWidth <= 330 ? 'fixed' : 'responsive'
    _attrs = {
      src: url,
      alt,
      width: imgWidth,
      height: height || size.height,
      layout,
      class: className,
      ..._attrs,
    }
    const _attrsStr = Object.keys(_attrs)
      .map((key) => `${key}="${_attrs[key]}"`)
      .join(' ')
    return `<amp-img ${_attrsStr}></amp-img>`
  }
  return ''
}

module.exports = {
  normalizeUrl,
  getRemoteFile,
  getRelativeFile,
  srcNode,
  addSearchParamsToUrl,
}
