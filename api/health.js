module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    ok: true,
    app: 'AIS Bangladesh Chapter UTP Dashboard',
    runtime: 'Vercel Serverless Function',
    timestamp: new Date().toISOString()
  });
};
