export default function handler(_req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ status: "ok" }));
}
