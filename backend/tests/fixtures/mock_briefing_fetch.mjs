// Loaded only by tests through --import, never by the production worker.
globalThis.fetch = async input => {
  const url = new URL(String(input))
  if (url.hostname !== 'apis.data.go.kr') throw new Error('Network is disabled in tests')
  const codeName = [...url.searchParams.keys()].find(key => key.endsWith('IxCd'))
  const rows = codeName ? [{ areaCd: url.searchParams.get('areaCd'), signguCd: url.searchParams.get('signguCd'), baseYm: url.searchParams.get('baseYm'), [codeName]: url.searchParams.get(codeName), [codeName.replace(/Cd$/, 'Val')]: '50' }] : []
  return Response.json({ response: { header: { resultCode: '0000' }, body: { totalCount: rows.length, items: { item: rows } } } })
}
