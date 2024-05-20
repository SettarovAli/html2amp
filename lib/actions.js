const actions = ($) => {
  const elements = $('[id^="_amp-"]')
  elements.each((i, element) => {
    $(element).attr('hidden', '')
  })
  return $
}

module.exports = actions
