const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>وثيقة تسليم مشروع نظام مزار لحجز وإدارة الشقق الفندقية | Handover Manual</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&family=Tajawal:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #12110F;
      --card-bg: #1C1A17;
      --card-border: #2E2A24;
      --primary-gold: #C1A68D;
      --primary-gold-light: #E0CEBE;
      --gold-dark: #8C6D53;
      --text-white: #FFFFFF;
      --text-muted: #A39E93;
      --text-dark: #2A2723;
      --accent-emerald: #10B981;
      --accent-amber: #F59E0B;
      --accent-rose: #EF4444;
      --accent-blue: #3B82F6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      background-color: #F8F6F2;
      color: #2A2723;
      line-height: 1.7;
      font-size: 13px;
    }

    @page {
      size: A4;
      margin: 14mm 14mm 16mm 14mm;
      @bottom-center {
        content: counter(page);
      }
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Page */
    .cover-container {
      background: linear-gradient(135deg, #1A1815 0%, #25221E 50%, #151412 100%);
      color: #FFFFFF;
      padding: 50px 40px;
      border-radius: 24px;
      margin-bottom: 30px;
      border: 2px solid #C1A68D;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      position: relative;
      overflow: hidden;
    }

    .cover-container::after {
      content: "";
      position: absolute;
      top: -100px;
      left: -100px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(193, 166, 141, 0.2) 0%, transparent 70%);
      border-radius: 50%;
    }

    .cover-badge {
      display: inline-block;
      background: rgba(193, 166, 141, 0.15);
      color: #C1A68D;
      border: 1px solid #C1A68D;
      padding: 6px 16px;
      border-radius: 50px;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1px;
      margin-bottom: 20px;
      text-transform: uppercase;
    }

    .cover-title {
      font-size: 32px;
      font-weight: 900;
      color: #FFFFFF;
      margin-bottom: 12px;
      line-height: 1.3;
    }

    .cover-subtitle {
      font-size: 16px;
      color: #C1A68D;
      font-weight: 600;
      margin-bottom: 35px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      border-top: 1px solid rgba(255,255,255,0.15);
      padding-top: 25px;
    }

    .meta-item {
      background: rgba(255,255,255,0.05);
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
    }

    .meta-label {
      font-size: 10px;
      color: #A39E93;
      font-weight: 700;
      display: block;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .meta-val {
      font-size: 12px;
      color: #FFFFFF;
      font-weight: 800;
    }

    /* Table of contents & Sections */
    h2.section-heading {
      font-size: 18px;
      font-weight: 900;
      color: #1A1815;
      border-right: 5px solid #C1A68D;
      padding-right: 12px;
      margin: 25px 0 15px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    h3.sub-heading {
      font-size: 14px;
      font-weight: 800;
      color: #4A4035;
      margin: 18px 0 10px 0;
    }

    p {
      margin-bottom: 12px;
      color: #38332D;
      text-align: justify;
    }

    /* Cards & Containers */
    .card {
      background: #FFFFFF;
      border: 1px solid #EAE4D9;
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }

    .dark-card {
      background: #1C1A17;
      color: #FFFFFF;
      border: 1px solid #2E2A24;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 18px;
    }

    .dark-card p {
      color: #D5CBB8;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 20px 0;
      background: #FFFFFF;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #EAE4D9;
      font-size: 11.5px;
    }

    table.data-table th {
      background: #25221E;
      color: #FFFFFF;
      font-weight: 800;
      padding: 10px 12px;
      text-align: right;
      border-bottom: 2px solid #C1A68D;
    }

    table.data-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #EAE4D9;
      color: #2A2723;
      vertical-align: middle;
    }

    table.data-table tr:nth-child(even) td {
      background: #FDFBF7;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-align: center;
    }

    .badge-gold { background: #F4EFEA; color: #8C6D53; border: 1px solid #C1A68D; }
    .badge-amber { background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; }
    .badge-emerald { background: #D1FAE5; color: #065F46; border: 1px solid #10B981; }
    .badge-blue { background: #DBEAFE; color: #1E40AF; border: 1px solid #3B82F6; }
    .badge-rose { background: #FFE4E6; color: #9F1239; border: 1px solid #EF4444; }

    /* Code blocks */
    code, pre {
      font-family: 'JetBrains Mono', monospace;
    }

    code {
      background: #F0ECE1;
      padding: 2px 6px;
      border-radius: 5px;
      font-size: 11px;
      color: #8C6D53;
      font-weight: 700;
    }

    pre {
      background: #151412;
      color: #E6E1D8;
      padding: 14px 16px;
      border-radius: 12px;
      overflow-x: auto;
      font-size: 11px;
      border: 1px solid #2E2A24;
      line-height: 1.6;
      margin: 12px 0 16px 0;
      direction: ltr;
      text-align: left;
    }

    /* Important Callouts */
    .callout {
      border-right: 4px solid #C1A68D;
      background: #FAF7F2;
      padding: 12px 16px;
      border-radius: 8px 0 0 8px;
      margin: 14px 0;
    }

    .callout-title {
      font-weight: 900;
      color: #8C6D53;
      font-size: 12px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .callout-warning {
      border-right-color: #EF4444;
      background: #FFF5F5;
    }

    .callout-warning .callout-title {
      color: #DC2626;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .unit-box {
      border: 1px solid #EAE4D9;
      background: #FFFFFF;
      padding: 10px 12px;
      border-radius: 10px;
    }

    .unit-box h4 {
      font-size: 12px;
      font-weight: 800;
      color: #1A1815;
      margin-bottom: 4px;
    }

    .unit-box p {
      font-size: 10.5px;
      margin: 0;
      color: #7A7061;
    }

    .footer-note {
      text-align: center;
      font-size: 10px;
      color: #A39E93;
      margin-top: 30px;
      border-top: 1px solid #EAE4D9;
      padding-top: 15px;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-container no-break">
    <div class="cover-badge">وثيقة سرية وتقنية خاصة بالمشروع • CONFIDENTIAL HANDOVER</div>
    <h1 class="cover-title">دليل تسليم وتشغيل وتطوير<br>مشروع مزار لإدارة الشقق والاستوديوهات الفندقية</h1>
    <div class="cover-subtitle">MAZAR BOOKING & ERP PLATFORM — TECHNICAL HANDOVER MANUAL</div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">إصدار النظام</span>
        <span class="meta-val">v1.0.0 (Production)</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">البيئة البرمجية</span>
        <span class="meta-val">Next.js 16 + React 19</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">قاعدة البيانات</span>
        <span class="meta-val">Supabase PostgreSQL</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">تاريخ التسليم</span>
        <span class="meta-val">أكتوبر 2026</span>
      </div>
    </div>
  </div>

  <!-- INTRODUCTION & PURPOSE -->
  <div class="card no-break">
    <h2 class="section-heading" style="margin-top: 0;">1. الغرض من هذا المستند (Document Purpose)</h2>
    <p>
      تم إعداد هذه الوثيقة الشاملة لتكون <strong>المرجع التنفيذي والتقني الأول</strong> لأي مهندس برمجي أو عضو جديد ينضم إلى فريق تطوير وإدارة منصة <strong>مزار (Mazar Booking)</strong>. 
      تحتوي هذه الوثيقة على كافة أسرار وتفاصيل النظام، ومعمارية الكود، وهيكل الفروع والوحدات، ومخطط قاعدة البيانات، ونظام الصلاحيات والحسابات، بالإضافة إلى القواعد الصارمة التي يجب اتباعها لضمان استقرار العمليات التشغيلية والمالية للفنادق بدون أي توقف أو فقد للبيانات.
    </p>
    <div class="callout">
      <div class="callout-title">📌 تنبيه موجه للمطور الجديد قبل استلام الكود:</div>
      <p style="margin: 0;">
        يجب قراءة وفهم هذا المستند بالكامل <strong>قبل البدء في تعديل أي سطر برمجي</strong>. منصة مزار ليست مجرد واجهة حجز، بل هي نظام ERP فندقي متكامل يدير غرف حقيقية، نزلاء فعليين، خزائن نقدية، ومرتبات موظفين.
      </p>
    </div>
  </div>

  <!-- SYSTEM ARCHITECTURE -->
  <div class="card no-break">
    <h2 class="section-heading">2. المعمارية التقنية وحزمة الأدوات (Tech Stack)</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>الطبقة (Layer)</th>
          <th>التقنية المستخدمة</th>
          <th>الإصدار / التفاصيل</th>
          <th>الوظيفة والمسؤولية</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Framework</strong></td>
          <td>Next.js (App Router)</td>
          <td><code>v16.1.6</code></td>
          <td>إدارة التوجيه السيرفري، صفحات SSR/SSG، و Server Actions</td>
        </tr>
        <tr>
          <td><strong>UI & Runtime</strong></td>
          <td>React & TypeScript</td>
          <td><code>React 19.2.3</code> / <code>TS 5.x</code></td>
          <td>بناء الواجهات التفاعلية بنظام مكونات قوي وآمن النوع (Type-safe)</td>
        </tr>
        <tr>
          <td><strong>Styling</strong></td>
          <td>Tailwind CSS</td>
          <td><code>v4.0.0</code></td>
          <td>نظام تصميم حديث بالهوية الخاصة بمزار (ألوان الفخامة الخشبية والذهبية)</td>
        </tr>
        <tr>
          <td><strong>Database & Storage</strong></td>
          <td>Supabase (PostgreSQL)</td>
          <td><code>@supabase/supabase-js 2.x</code></td>
          <td>قاعدة بيانات علائقية سحابية وتخزين إيصالات السداد وملاحظات العملاء</td>
        </tr>
        <tr>
          <td><strong>Desktop Client</strong></td>
          <td>Electron + Electron Builder</td>
          <td><code>Electron 33.x</code></td>
          <td>تحويل المنصة إلى برنامج سطح مكتب محلي يعمل بنظام Windows Portable</td>
        </tr>
        <tr>
          <td><strong>Notifications</strong></td>
          <td>Telegram Bot + WhatsApp Web API</td>
          <td>HTTP Webhooks</td>
          <td>إرسال إشعارات فورية لكل حجز جديد مع رابط محادثة واتساب مباشر</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- BRANCHES & UNITS BREAKDOWN -->
  <div class="page-break"></div>
  <div class="card">
    <h2 class="section-heading">3. هيكل الفروع وتوزيع الوحدات (Branches & Units Structure)</h2>
    <p>
      تم تصميم المنصة لإدارة فروع متعددة بوحدات ذات طبيعة مختلفة (استوديوهات، أجنحة غرفتين، شقق خارجية فاخرة). وفيما يلي التوزيع الدقيق للوحدات:
    </p>

    <div class="grid-2">
      <div class="unit-box">
        <h4>🏢 مزار 1 (الفرع الأول - استوديوهات بريميوم)</h4>
        <p><strong>المعرفات في الكود:</strong> <code>b1-s1</code> إلى <code>b1-s12</code></p>
        <p><strong>الاسم الظاهر:</strong> استوديو 1 إلى استوديو 12 (استوديو 7 مستثنى أو ملغي)</p>
        <p><strong>الفيديو المربوط:</strong> <code>/images/video/studio-{num}.mp4</code></p>
      </div>

      <div class="unit-box">
        <h4>🏢 مزار 2 (الفرع الثاني - استوديوهات بريميوم)</h4>
        <p><strong>المعرفات في الكود:</strong> <code>b2-s1</code> إلى <code>b2-s12</code></p>
        <p><strong>الاسم الظاهر:</strong> س 13 إلى س 24 (استوديو بريميوم 13 إلى 24)</p>
        <p><strong>الفيديو المربوط:</strong> <code>/images/video/studio-{num+12}.mp4</code></p>
      </div>

      <div class="unit-box">
        <h4>🌴 مزار 3 (الفرع الثالث - شقق غرفتين / أكورة)</h4>
        <p><strong>المعرفات في الكود:</strong> <code>p-s25</code> إلى <code>p-s30</code></p>
        <p><strong>الاسم الظاهر:</strong> شقة غرفتين (25) إلى شقة غرفتين (30)</p>
        <p><strong>الفيديو المربوط:</strong> <code>/images/video/apartment-26.mp4</code></p>
      </div>

      <div class="unit-box">
        <h4>⭐ الشقق الفندقية الخارجية (Luxury Apartments)</h4>
        <p><strong>المعرفات في الكود:</strong> <code>apt-1</code>، <code>apt-2</code>، <code>apt-3</code></p>
        <p><strong>الاسم الظاهر:</strong> زكي رستم (1)، سيتي ستارز (2)، عباس الرئيسي (3)</p>
        <p><strong>الفيديو المربوط:</strong> <code>/images/video/apartment-26.mp4</code></p>
      </div>
    </div>

    <div class="callout callout-warning" style="margin-top: 15px;">
      <div class="callout-title">⚠️ قاعدة هامة في توحيد المسميات المالية (Treasury Formatter):</div>
      <p style="margin: 0; font-size: 11.5px;">
        دالة <code>formatTreasuryUnitName</code> في <code>src/lib/utils.ts</code> تقوم بتحويل كافة الأسماء تلقائياً في جداول الخزينة والتقارير إلى الرمز الموحد (مثل <code>س 1</code> إلى <code>س 24</code> للشقق والاستوديوهات)، وذلك لتفادي ازدواجية الأسماء بين الحجوزات القديمة والجديدة.
      </p>
    </div>
  </div>

  <!-- DATABASE SCHEMAS -->
  <div class="card">
    <h2 class="section-heading">4. مخطط قاعدة البيانات في Supabase (Database Schema)</h2>
    <p>النظام يعتمد على 9 جداول رئيسية داخل Supabase PostgreSQL:</p>

    <table class="data-table">
      <thead>
        <tr>
          <th>اسم الجدول</th>
          <th>الوظيفة والبيانات المخزنة</th>
          <th>أهم الأعمدة والحقول الرئيسية</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>bookings</code></td>
          <td>جدول الحجوزات الرئيسي لجميع الفروع</td>
          <td><code>id, name, phone, studio, apartmentId, checkIn, checkOut, numberOfDays, totalAmount, paidAmount, paymentMethod, paymentSplits, status, notes, bookingManager, created_at</code></td>
        </tr>
        <tr>
          <td><code>units</code></td>
          <td>كتالوج الوحدات والأسعار والمواصفات</td>
          <td><code>id, title, description, price, weekendPrice, category, features, images, videoSrc, isAvailable</code></td>
        </tr>
        <tr>
          <td><code>admins</code></td>
          <td>المستخدمون والمدراء والمشرفون</td>
          <td><code>id, username, password, name, role, permissions, active</code></td>
        </tr>
        <tr>
          <td><code>translations</code></td>
          <td>تخزين البيانات المرنة والملاحظات العامة</td>
          <td><code>id (102 لملاحظات العملاء الدائمة، 100/101 للمهام وقوائم التهيئه), data (JSONB), updated_at</code></td>
        </tr>
        <tr>
          <td><code>expenses</code></td>
          <td>مصروفات الفروع والصيانة والمشتريات</td>
          <td><code>id, branch, unitId, category, amount, description, paymentMethod, expenseDate, invoiceUrl, adminName</code></td>
        </tr>
        <tr>
          <td><code>treasury_transfers</code></td>
          <td>حركات الخزينة والتحويلات النقدية والبنكية</td>
          <td><code>id, fromAccount, toAccount, amount, date, transferType, notes, createdBy</code></td>
        </tr>
        <tr>
          <td><code>staff</code></td>
          <td>دليل موظفي الموارد البشرية والعمال</td>
          <td><code>id, name, role, branch, phone, basicSalary, hireDate, status</code></td>
        </tr>
        <tr>
          <td><code>salaries</code></td>
          <td>مسيرات الرواتب الشهرية والخصومات والمكافآت</td>
          <td><code>id, staffId, month, year, basicSalary, bonuses, deductions, netSalary, status, paidAt</code></td>
        </tr>
        <tr>
          <td><code>vacations</code></td>
          <td>سجل الإجازات والأذونات للموظفين</td>
          <td><code>id, staffId, startDate, endDate, daysCount, type, reason, status</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ROLES & SECURITY -->
  <div class="page-break"></div>
  <div class="card">
    <h2 class="section-heading">5. نظام الصلاحيات والحسابات الأمنية (Roles & Permissions)</h2>
    <p>
      تم تخصيص صلاحيات محددة وصارمة لكل شريك أو دور إداري داخل المنصة لضمان عدم تسريب البيانات المالية بين الشركاء:
    </p>

    <table class="data-table">
      <thead>
        <tr>
          <th>الدور (Role)</th>
          <th>اسم المستخدم الثابت</th>
          <th>نطاق الصلاحيات والرؤية</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-gold">Owner</span></td>
          <td><code>mo2men</code> / <code>medhat</code></td>
          <td><strong>صلاحيات كاملة مطلقة:</strong> رؤية جميع الفروع (1، 2، 3)، الشقق الخارجية، الخزينة العامة، الأرباح، الرواتب، وحذف وتعديل كافة البيانات.</td>
        </tr>
        <tr>
          <td><span class="badge badge-blue">Admin</span></td>
          <td><code>admin</code></td>
          <td>إدارة التشغيل اليومي، تسكين النزلاء، تسجيل المدفوعات والمصروفات، واعتماد الحجوزات.</td>
        </tr>
        <tr>
          <td><span class="badge badge-emerald">Moderator</span></td>
          <td><code>moderator</code></td>
          <td>متابعة حالات الحجوزات الجديدة، وتأكيد الحجوزات وإصدار تأكيدات الدخول.</td>
        </tr>
        <tr>
          <td><span class="badge badge-amber">Mohsen</span></td>
          <td><code>mohsen</code></td>
          <td>
            <strong>خاص بمزار 1 و 2 فقط:</strong><br>
            • يرى فقط حركات الدخول والخروج وإجمالي إيجارات مزار 1 و 2.<br>
            • <strong>محجوب عنه تماماً:</strong> وحدات مزار 3، الشقق الخارجية، الشاليهات، وتقارير الشركاء الآخرين.
          </td>
        </tr>
        <tr>
          <td><span class="badge badge-rose">Akoura / Aura</span></td>
          <td><code>akoura</code> / <code>aura</code></td>
          <td>
            <strong>خاص بمزار 3 (شقق غرفتين) فقط:</strong><br>
            • يرى فقط تقارير وحجوزات مزار 3 (الوحدات 25 إلى 30).<br>
            • لا يرى إطلاقاً مزار 1 أو 2 أو الحسابات المركزية.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- CUSTOMER PROFILES VS BOOKING NOTES -->
  <div class="card">
    <h2 class="section-heading">6. محرك ملاحظات العملاء مقابل ملاحظات الحجز (Crucial Separation)</h2>
    <p>
      واحدة من أدق المميزات في النظام هي <strong>الفصل المطلق</strong> بين نوعين من الملاحظات:
    </p>

    <div class="grid-2">
      <div class="dark-card" style="margin-bottom: 0;">
        <h3 style="color: #F59E0B; font-size: 13px; margin-bottom: 8px;">⭐ ملاحظات العميل الدائمة (Customer Profile Notes)</h3>
        <p style="font-size: 11.5px;">
          • مرتبطة برقم هاتف العميل واسمه وتخزن في <code>translations</code> برقم ID: <code>102</code>.<br>
          • <strong>ترافق العميل في كل حجوزاته:</strong> إذا حجز اليوم في مزار 1، وحجز الشهر القادم في مزار 2، تظهر ملاحظته في الحجزين.<br>
          • تظهر كعلامة صفراء بارزة <code>⭐ ملاحظة</code> بجانب اسم العميل في كل الشاشات.<br>
          • عند الضغط عليها تفتح نافذة فايل العميل الكامل مع سجل حجوزاته السابقة وإجمالي لياليه.
        </p>
      </div>

      <div class="dark-card" style="margin-bottom: 0;">
        <h3 style="color: #10B981; font-size: 13px; margin-bottom: 8px;">📝 ملاحظات الحجز الفردي (Booking Notes)</h3>
        <p style="font-size: 11.5px;">
          • مرتبطة بالحجز نفسه وتخزن في عمود <code>bookings.notes</code>.<br>
          • <strong>تخص المكان الحالي فقط:</strong> مثل: (عقد، متبقي 1500، استلم المفتاح، دفع كاش، سداد تأمين).<br>
          • لا تظهر في ملفات الحجوزات الأخرى لنفس العميل إطلاقاً.<br>
          • تحميها دالة <code>cleanManualNotes</code> حتى لا يتم مسح أي كلمة يدخلها موظف الاستقبال.
        </p>
      </div>
    </div>

    <div class="callout" style="margin-top: 14px;">
      <div class="callout-title">💡 آلية توحيد الهواتف (Phone Normalization Engine):</div>
      <p style="margin: 0; font-size: 11.5px;">
        دالة <code>getPhoneVariants</code> في <code>src/lib/utils.ts</code> تولد كافة التنسيقات لأي رقم (مثل <code>010...</code>، <code>2010...</code>، الواتساب الدولي، أو الأرقام السعودية <code>966...</code>)، مما يضمن ظهور ملاحظة العميل حتى لو أدخل موظف الرقم بدون صفر أو بكود الدولة.
      </p>
    </div>
  </div>

  <!-- CORE SCREENS & DASHBOARDS -->
  <div class="page-break"></div>
  <div class="card">
    <h2 class="section-heading">7. خريطة الشاشات ولوحة التحكم الإدارية (Dashboard Modules)</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>المسار (Route)</th>
          <th>اسم الصفحة</th>
          <th>الوظيفة التشغيلية</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>/admin/dashboard</code></td>
          <td>لوحة المتابعة اليومية الرئيسية</td>
          <td>مخطط الوحدات المباشر، حركات وصول اليوم (🛬)، حركات مغادرة اليوم (🛫)، خريطة الإشغال، الإحصائيات السريعة.</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/reports</code></td>
          <td>شيت التقارير التشغيلية والمالية</td>
          <td>أهم صفحة في النظام: جدول تشغيلي شهري كامل لكل وحدة، التعديل المباشر (Inline Editing)، المرحّلات، المصروفات، وتصدير إكسل والطباعة.</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/bookings</code></td>
          <td>إدارة كافة الحجوزات</td>
          <td>فلترة الحجوزات حسب التاريخ، الوحدة، الحالة، الاسم، مع إمكانية تعديل وحذف وإضافة حجز جديد يدوياً.</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/treasury</code></td>
          <td>الخزينة والحسابات المركزية</td>
          <td>إدارة الخزائن النقدية، الحسابات البنكية، حركات التحويل الداخلي بين الحسابات، وصافي الأرصدة المتوفرة.</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/custody</code></td>
          <td>إدارة العهد النقدية للموظفين</td>
          <td>تسليم عهد للمشرفين والعمال، متابعة فواتير الصرف، وتصفية العهد المتبقية.</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/hr/...</code></td>
          <td>الموارد البشرية والرواتب</td>
          <td>ملفات الموظفين (<code>staff</code>)، مسيرات الرواتب الشهرية والخصومات (<code>salaries</code>)، وإجازات الموظفين (<code>vacations</code>).</td>
        </tr>
        <tr>
          <td><code>/admin/dashboard/units</code></td>
          <td>كتالوج وتعديل الوحدات</td>
          <td>تعديل أسعار الليلة العادية والويك إند، رفع الصور والفيديوهات، وتغيير حالة الوحدات (متاح / صيانة).</td>
        </tr>
        <tr>
          <td><code>/mazar/...</code></td>
          <td>موقع الحجز العام للجمهور</td>
          <td>الواجهة الموجهة للعملاء لاستعراض الاستوديوهات والشقق، حساب إجمالي التكلفة، وإرسال طلب الحجز أونلاين.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- INSTALLATION & DEPLOYMENT -->
  <div class="card">
    <h2 class="section-heading">8. دليل التثبيت والتشغيل المحلي والإنتاجي (Installation & Run)</h2>

    <h3 class="sub-heading">أ. متطلبات التشغيل الأساسية (Prerequisites):</h3>
    <p>• Node.js الإصدار 20 أو 22 (مُوصى بـ <code>v22.x</code>).<br>• مدير الحزم <code>npm</code>.<br>• حساب وصلاحيات على Supabase Project الخاص بمزار.</p>

    <h3 class="sub-heading">ب. إعداد ملف البيئة (<code>.env.local</code>):</h3>
    <pre>
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram Instant Notifications (اختياري للإشعارات)
TG_TOKEN=123456789:AAFakeTokenForTelegramBot
TG_CHAT_ID=-1001234567890
    </pre>

    <h3 class="sub-heading">جـ. أوامر التشغيل (Commands):</h3>
    <pre>
# 1. تثبيت الحزم والمكتبات
npm install

# 2. تشغيل السيرفر المحلي في وضع التطوير (Dev Server)
npm run dev

# 3. بناء المشروع وتجهيزه للإنتاج (Production Build)
npm run build

# 4. تشغيل نسخة سطح المكتب (Electron Desktop App)
npm run desktop

# 5. بناء ملف التثبيت المكتبي لنظام Windows (Installer / Portable)
npm run electron:build
    </pre>
  </div>

  <!-- HANDOVER CHECKLIST FOR TEAM -->
  <div class="page-break"></div>
  <div class="card no-break">
    <h2 class="section-heading">9. ميثاق العمل والتعليمات الصارمة لفريق البرمجة (Rules of Engagement)</h2>

    <div class="callout callout-warning">
      <div class="callout-title">⛔ خطوط حمراء يجب عدم كسرها تحت أي ظرف:</div>
      <p style="margin: 0; font-size: 11.5px;">
        1. <strong>لا تقم بدمج ملاحظات العميل الدائمة مع ملاحظات الحجز:</strong> ملاحظات العميل في <code>translations 102</code> وملاحظات الحجز في <code>bookings.notes</code>. أي خلط بينهما يؤدي لمشاكل محاسبية للمكان.<br>
        2. <strong>لا تعدل صلاحيات حساب محسن أو أكورة:</strong> هذا يمثل اختراقاً لخصوصية الشركاء في الفروع.<br>
        3. <strong>حسابات الإجمالي والمدفوع:</strong> في جدول التقارير التشغيلية (<code>reports/page.tsx</code>)، لا تعدل دوال احتساب الليالي والإيرادات دون فحص شامل لاختبارات الـ Build.<br>
        4. <strong>الفيديوهات والصور:</strong> مسارات الفيديوهات موحدة داخل <code>resolveUnitVideo</code>، لا تكتب مسارات ذات حروف عربية في قاعدة البيانات.
      </p>
    </div>

    <h3 class="sub-heading">قائمة تسليم المهام (Developer Handover Checklist):</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>البند</th>
          <th>حالة الفحص</th>
          <th>ملاحظات المطور</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>استلام وصول لوحة تحكم Supabase Database</td>
          <td><span class="badge badge-emerald">مكتمل</span></td>
          <td>التأكد من توفر Service Role Key</td>
        </tr>
        <tr>
          <td>استلام كود المستودع من GitHub</td>
          <td><span class="badge badge-emerald">مكتمل</span></td>
          <td>الفرع الرئيسي <code>main</code></td>
        </tr>
        <tr>
          <td>بناء المشروع بنجاح على الجهاز المحلي (Build Check)</td>
          <td><span class="badge badge-emerald">ناجح 100%</span></td>
          <td><code>npm run build</code> تم التحقق منه بالكامل</td>
        </tr>
        <tr>
          <td>فحص وتجربة بوت تليجرام للتنبيهات</td>
          <td><span class="badge badge-emerald">يعمل</span></td>
          <td>إرسال الحجوزات مع رابط واتساب فوري</td>
        </tr>
        <tr>
          <td>فحص ظهور العلامة الصفراء لملف العميل على الموبايل والـ PC</td>
          <td><span class="badge badge-emerald">تم التحديث</span></td>
          <td>جاهز ويعمل بسلاسة على شاشات اللمس والكمبيوتر</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-note">
      تم إنشاء هذه الوثيقة وتجهيزها رسميًا لصالح إدارة مزار لحجز وإدارة الشقق الفندقية • جميع الحقوق محفوظة © 2026
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '../docs/handover_manual.html'), htmlContent, 'utf8');
console.log('HTML Manual Generated Successfully at docs/handover_manual.html');
