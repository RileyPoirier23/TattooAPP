// Fake Square API used by the end-to-end tests (never used in production).
import http from 'node:http';
let n = 0;
http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      const send = json => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      n++;
      if (req.url.startsWith('/v2/locations/')) return send({ location: { currency: 'CAD' } });
      if (req.url === '/v2/payments') return send({ payment: { id: `pay_${n}`, status: 'COMPLETED', receipt_url: 'https://example.com/receipt' } });
      if (req.url === '/v2/refunds') return send({ refund: { id: `ref_${n}`, status: 'PENDING' } });
      if (req.url === '/v2/customers') return send({ customer: { id: 'cust_1' } });
      if (req.url === '/v2/cards') return send({ card: { id: `card_${n}`, card_brand: 'VISA', last_4: '4242' } });
      send({ ok: true, body });
    });
  })
  .listen(Number(process.env.MOCK_SQUARE_PORT || 4999));
