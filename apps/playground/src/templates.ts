type Template = {
  name: string;
  html: string;
};

const HERO: Template = {
  name: "Hero",
  html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">
<style>
  body {
    margin: 0;
    font-family: Inter, sans-serif;
    background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hero {
    max-width: 600px;
    text-align: center;
    padding: 48px;
  }
  .hero h1 {
    font-size: 56px;
    font-weight: 700;
    margin: 0 0 16px;
    color: #18181b;
    letter-spacing: -0.02em;
  }
  .hero p {
    font-size: 18px;
    color: #52525b;
    margin: 0 0 32px;
    line-height: 1.6;
  }
  .hero .cta {
    display: inline-block;
    padding: 12px 24px;
    background: #f97316;
    color: white;
    border-radius: 8px;
    font-weight: 500;
    text-decoration: none;
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
  }
</style>
<div class="hero">
  <h1>Ship designs faster</h1>
  <p>Convert HTML to editable Figma layers without leaving your browser.</p>
  <a href="#" class="cta">Get started</a>
</div>`,
};

const CARD: Template = {
  name: "Card",
  html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">
<style>
  body {
    margin: 0;
    padding: 48px;
    background: #f4f4f5;
    font-family: Inter, sans-serif;
  }
  .card {
    max-width: 360px;
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 24px rgba(0, 0, 0, 0.06);
  }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    background: #eff6ff;
    color: #2563eb;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 16px;
  }
  .card h2 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #18181b;
  }
  .card p {
    margin: 0;
    color: #71717a;
    font-size: 14px;
    line-height: 1.5;
  }
</style>
<div class="card">
  <span class="badge">New</span>
  <h2>Gradient mesh background</h2>
  <p>Beautiful gradients with smooth transitions, generated entirely in CSS.</p>
</div>`,
};

const FORM: Template = {
  name: "Form",
  html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">
<style>
  body {
    margin: 0;
    padding: 48px;
    background: #fafafa;
    font-family: Inter, sans-serif;
  }
  .form {
    max-width: 360px;
    background: white;
    padding: 32px;
    border-radius: 12px;
    border: 1px solid #e4e4e7;
  }
  .form h2 {
    margin: 0 0 24px;
    font-size: 20px;
    color: #18181b;
  }
  .form label {
    display: block;
    font-size: 13px;
    color: #52525b;
    margin-bottom: 6px;
    font-weight: 500;
  }
  .form input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 16px;
    box-sizing: border-box;
  }
  .form button {
    width: 100%;
    padding: 10px;
    background: #18181b;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
</style>
<form class="form">
  <h2>Sign in</h2>
  <label>Email</label>
  <input type="email" placeholder="you@example.com" />
  <label>Password</label>
  <input type="password" placeholder="••••••••" />
  <button type="button">Continue</button>
</form>`,
};

export const TEMPLATES = [HERO, CARD, FORM] as const;
