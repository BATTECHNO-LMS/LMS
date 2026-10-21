/**
 * Career-track catalog for the public internship journey.
 * Content is copied verbatim from BATMAN_TECHNOLOGY_Internship_Journey_V4.html;
 * keep it in sync with that source rather than editing copy here in isolation.
 */

/** Career-focused track families. Each has exactly three specialization modules. */
export const TRACK_CATALOG = {
  "backend": {
    "name": "تطوير الأنظمة الخلفية",
    "role": "Junior Backend Developer",
    "emoji": "💻",
    "project": "بناء API لنظام حجوزات حقيقي، مع أدوار مستخدمين، قاعدة بيانات PostgreSQL، اختبارات آلية وتوثيق للنشر.",
    "modules": [
      {
        "title": "Backend Engineering",
        "desc": "تحويل طلب عمل إلى خدمة API قابلة للاستخدام.",
        "tags": [
          "Python",
          "FastAPI",
          "REST"
        ],
        "tasks": [
          "تحويل User Story إلى endpoints واضحة",
          "بناء CRUD مع validation و error handling",
          "تطبيق Authentication و Roles في بيئة محلية",
          "كتابة اختبارات للوحدات والواجهات",
          "مراجعة Pull Request مع المشرف"
        ]
      },
      {
        "title": "Database & Data Modeling",
        "desc": "بناء قاعدة بيانات تضمن اتساق البيانات.",
        "tags": [
          "PostgreSQL",
          "ERD",
          "SQL"
        ],
        "tasks": [
          "رسم ERD لحالات الاستخدام",
          "تصميم جداول وفهارس وقيود",
          "كتابة joins ومعالجة العلاقات",
          "إنشاء migrations وبيانات تجريبية",
          "اختبار معاملات الإدخال والقراءة"
        ]
      },
      {
        "title": "API Delivery & Integration",
        "desc": "تسليم المنتج لفريق آخر.",
        "tags": [
          "Postman",
          "OpenAPI",
          "Docker"
        ],
        "tasks": [
          "ربط API مع عميل تجريبي",
          "توثيق OpenAPI وأمثلة الطلبات",
          "تجهيز متغيرات البيئة بأمان",
          "إعداد تشغيل محلي باستخدام Docker",
          "تقديم Demo ومراجعة المشاكل"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "fullstack": {
    "name": "هندسة البرمجيات وتطوير الويب",
    "role": "Junior Full-Stack Developer",
    "emoji": "🧩",
    "project": "تنفيذ نظام طلبات أو تذاكر عمل: واجهة React/Next.js، API، قاعدة بيانات، اختبارات وخط سير Code Review.",
    "modules": [
      {
        "title": "Product & Requirements",
        "desc": "فهم متطلبات المستخدم وتحويلها لمهام قابلة للتحقق.",
        "tags": [
          "User Stories",
          "Figma",
          "Agile"
        ],
        "tasks": [
          "صياغة 3 User Stories مع Acceptance Criteria",
          "تحديد حالات الخطأ وحالات التحميل",
          "رسم Wireframes للشاشات",
          "تجزئة العمل إلى Tickets وتقديرها",
          "عرض الخطة على صاحب المصلحة"
        ]
      },
      {
        "title": "Full-Stack Feature Delivery",
        "desc": "تطوير ميزة كاملة من الواجهة حتى قاعدة البيانات.",
        "tags": [
          "React",
          "Next.js",
          "API"
        ],
        "tasks": [
          "بناء واجهة متجاوبة وقابلة للاستخدام",
          "إنشاء endpoint مرتبط بقاعدة البيانات",
          "إضافة validation وحالات النجاح والفشل",
          "مراجعة Accessibility على النماذج",
          "إرسال Pull Request بعد الاختبار"
        ]
      },
      {
        "title": "Quality & Release",
        "desc": "العمل مثل فريق منتج حقيقي.",
        "tags": [
          "Playwright",
          "Git",
          "CI"
        ],
        "tasks": [
          "كتابة سيناريوهات اختبار واضحة",
          "إصلاح Bug موثّق بخطوات إعادة إنتاج",
          "تشغيل Smoke Tests قبل الإصدار",
          "توثيق خطوات النشر وإعداداته",
          "إجراء Demo و Retrospective"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "pentest": {
    "name": "اختبار الاختراق الأخلاقي",
    "role": "Junior Penetration Tester",
    "emoji": "🛡️",
    "project": "تقييم اختراق لتطبيق ويب مختبري مملوك للتدريب أو مصرح به كتابياً، مع إثبات مفهوم آمن وتقرير تقني وخطة معالجة.",
    "modules": [
      {
        "title": "Recon & Scope",
        "desc": "تعلّم منهجية اختبار الاختراق ونطاق التفويض.",
        "tags": [
          "Scope",
          "Nmap",
          "Burp Suite"
        ],
        "tasks": [
          "كتابة Rules of Engagement ونطاق التفويض",
          "حصر الأصول المصرح بها في مختبر مغلق",
          "تحديد الخدمات والمنافذ في المختبر",
          "إعداد Burp Proxy وتسجيل طلبات HTTP",
          "إعداد Attack Surface Inventory"
        ]
      },
      {
        "title": "Web Pentesting Labs",
        "desc": "فحص ثغرات الويب بشكل عملي وآمن.",
        "tags": [
          "OWASP",
          "Burp",
          "Juice Shop"
        ],
        "tasks": [
          "اختبار Broken Access Control مختبرياً",
          "فحص إدخال غير آمن في تطبيق تدريبي",
          "فحص Session Management ضمن النطاق",
          "توثيق أثر كل نتيجة بأدلة منزوعة الأسرار",
          "اقتراح إصلاح لكل ملاحظة أمنية"
        ]
      },
      {
        "title": "Reporting & Retesting",
        "desc": "تحويل الاختبار إلى خدمة استشارية احترافية.",
        "tags": [
          "CVSS",
          "Reporting",
          "Retest"
        ],
        "tasks": [
          "تصنيف النتائج حسب الأثر والاحتمالية",
          "كتابة Vulnerability Report قابلة للتنفيذ",
          "عرض النتائج على دور Developer تجريبي",
          "إعادة اختبار الثغرات بعد المعالجة",
          "تسليم التقرير التنفيذي والملحق الفني"
        ]
      }
    ],
    "note": "جميع المختبرات محلية أو ضمن أنظمة يوجد تفويض صريح لفحصها. لا تُجرى أي محاولة على أهداف عامة أو حسابات الغير.",
    "artifacts": "Written Authorization • Lab Evidence • Findings • Remediation • Retest Report"
  },
  "ai": {
    "name": "هندسة تطبيقات الذكاء الاصطناعي",
    "role": "Junior AI Application Developer",
    "emoji": "🤖",
    "project": "إنشاء مساعد معرفي RAG يجيب من وثائق مؤسسية مصرح بها، يعرض مصادر الإجابة، ويقاس باختبارات دقة وفشل وحماية بيانات.",
    "modules": [
      {
        "title": "Python & LLM API Integration",
        "desc": "تطوير تطبيق AI يعمل فعلاً ويتصل بمصدر بيانات.",
        "tags": [
          "Python",
          "LLM APIs",
          "JSON"
        ],
        "tasks": [
          "إعداد Python environment وإدارة الأسرار",
          "بناء API يستقبل استفسارات المستخدم",
          "استخدام Structured Outputs والتحقق منها",
          "إضافة إدارة للأخطاء وحدود الاستهلاك",
          "كتابة اختبارات لحالات استجابة مختلفة"
        ]
      },
      {
        "title": "RAG & Retrieval",
        "desc": "ربط النموذج بمحتوى موثوق بدل الاعتماد على ذاكرته.",
        "tags": [
          "Embeddings",
          "Retrieval",
          "RAG"
        ],
        "tasks": [
          "تنظيف وثائق تجريبية وتقسيمها",
          "بناء فهرس بحث باستخدام Embeddings",
          "إرجاع مقتطفات داعمة مع الإجابات",
          "تحسين Retrieval وتجربة الأسئلة الصعبة",
          "منع الكشف غير المصرح به للمستندات"
        ]
      },
      {
        "title": "AI Evaluation & Production",
        "desc": "تقييم الجودة والكلفة والأمان قبل التسليم.",
        "tags": [
          "Eval Set",
          "Guardrails",
          "Monitoring"
        ],
        "tasks": [
          "بناء مجموعة 30 سؤالاً واختباراً مرجعياً",
          "قياس Groundedness ودقة الاسترجاع",
          "اختبار رفض الأسئلة خارج المحتوى",
          "تتبع زمن الاستجابة والتكلفة",
          "تقديم Demo مع Known Limitations"
        ]
      }
    ],
    "note": "لا ندرّب الطلاب على Prompt Engineering وحده؛ الناتج تطبيق AI فعلي مع قياسات جودة وأمان.",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "data": {
    "name": "تحليل البيانات وعلم البيانات",
    "role": "Junior Data Analyst",
    "emoji": "📊",
    "project": "تحليل بيانات مبيعات أو حجوزات، إعداد Dashboard تفاعلي، وتسليم تقرير قرارات تجارية؛ نموذج ML بسيط اختياري في المدد الطويلة.",
    "modules": [
      {
        "title": "Data Cleaning & SQL",
        "desc": "تهيئة بيانات حقيقية قابلة للتحليل.",
        "tags": [
          "SQL",
          "Pandas",
          "Data Quality"
        ],
        "tasks": [
          "قراءة بيانات CSV/SQL وفهم قاموس البيانات",
          "كشف القيم المفقودة والمكررة",
          "كتابة استعلامات تجميع ومقارنات",
          "تحليل التغير عبر الزمن",
          "توثيق خطوات التنظيف والتحقق"
        ]
      },
      {
        "title": "BI & Dashboard",
        "desc": "تحويل التحليل إلى لوحة سهلة الفهم.",
        "tags": [
          "Power BI",
          "DAX",
          "KPIs"
        ],
        "tasks": [
          "تحديد 5 مؤشرات أعمال ذات معنى",
          "بناء Data Model وعلاقات صحيحة",
          "إنشاء Dashboard بفلاتر وتواريخ",
          "التحقق من أرقام المؤشرات",
          "اختبار اللوحة مع سيناريو صاحب مصلحة"
        ]
      },
      {
        "title": "Insights & Predictive Analysis",
        "desc": "استخراج توصيات مبنية على الأدلة.",
        "tags": [
          "EDA",
          "Storytelling",
          "Scikit-learn"
        ],
        "tasks": [
          "تحديد 3 Insights مدعومة بأرقام",
          "شرح القيود والتحيزات في البيانات",
          "تصميم عرض النتائج وتوصيات العمل",
          "مقارنة Baseline Model عند توفر الوقت",
          "تسليم ملخص تنفيذي قابل للاستخدام"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "dataeng": {
    "name": "هندسة البيانات",
    "role": "Junior Data Engineer",
    "emoji": "🗂️",
    "project": "بناء Data Pipeline صغير من مصدر API و CSV إلى PostgreSQL ومستودع تحليلي محلي مع اختبارات جودة وتشغيل مجدول.",
    "modules": [
      {
        "title": "Data Ingestion",
        "desc": "تجميع البيانات من مصادر متعددة.",
        "tags": [
          "Python",
          "APIs",
          "CSV"
        ],
        "tasks": [
          "تحديد عقود البيانات والحقول",
          "سحب بيانات من API تجريبي",
          "التعامل مع pagination وأخطاء الشبكة",
          "استخدام logging لمعرفة الأعطال",
          "تخزين Raw Data آمن"
        ]
      },
      {
        "title": "Pipelines & Modeling",
        "desc": "تحويل البيانات وإعدادها للتحليل.",
        "tags": [
          "SQL",
          "ETL",
          "PostgreSQL"
        ],
        "tasks": [
          "تصميم طبقات raw/staging/mart",
          "إنشاء transforms قابلة لإعادة التشغيل",
          "التحقق من المفاتيح والقيم الناقصة",
          "إضافة اختبارات Data Quality",
          "توثيق Data Lineage"
        ]
      },
      {
        "title": "Orchestration & Delivery",
        "desc": "تشغيل Pipeline ومراقبته.",
        "tags": [
          "Scheduling",
          "Docker",
          "Monitoring"
        ],
        "tasks": [
          "تشغيل المهام وفق schedule محلي",
          "اختبار فشل وإعادة المحاولة",
          "إعداد Dashboard مراقبة مبسط",
          "تسليم README و Runbook",
          "تنفيذ Demo لانتقال البيانات"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "it": {
    "name": "الدعم التقني وإدارة الأنظمة",
    "role": "Junior IT Support / Systems Technician",
    "emoji": "🖥️",
    "project": "إنشاء بيئة شركة افتراضية لموظفين وحسابات وملفات ودعم فني، مع إجراءات تشغيل وسجل تذاكر وتوثيق حلول.",
    "modules": [
      {
        "title": "IT Service Desk",
        "desc": "حل مشاكل المستخدمين بمهنية.",
        "tags": [
          "Ticketing",
          "Troubleshooting",
          "SLA"
        ],
        "tasks": [
          "استقبال وتوثيق تذاكر دعم تدريبية",
          "فرز الأعطال حسب الأولوية",
          "تحليل مشكلة اتصال أو طباعة تجريبية",
          "تنفيذ تشخيص خطوة بخطوة",
          "إغلاق التذكرة مع توثيق الحل"
        ]
      },
      {
        "title": "Systems & Network Operations",
        "desc": "إدارة بيئة IT صغيرة داخل المختبر.",
        "tags": [
          "Windows",
          "Linux",
          "Networking"
        ],
        "tasks": [
          "إعداد مستخدمين وصلاحيات في VM",
          "تنفيذ نسخ احتياطي واستعادة اختبارية",
          "التحقق من IP/DNS في المختبر",
          "تطبيق إعدادات تحديثات أساسية",
          "كتابة Runbook للإجراءات المتكررة"
        ]
      },
      {
        "title": "Service Delivery & Security",
        "desc": "تقديم خدمة ثابتة ومحكومة.",
        "tags": [
          "Asset Register",
          "Policies",
          "Documentation"
        ],
        "tasks": [
          "إعداد سجل أصول تقنية تجريبي",
          "تحديد سياسة كلمات مرور وصلاحيات",
          "تصميم Checklist لتجهيز موظف جديد",
          "قياس زمن حل التذاكر",
          "تقديم تقرير تشغيل شهري تجريبي"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "network": {
    "name": "إدارة الشبكات والبنية التحتية",
    "role": "Junior Network Engineer",
    "emoji": "🌐",
    "project": "تصميم وتشغيل شبكة فرعية متعددة VLANs في بيئة محاكاة، واختبار الاتصال والتوثيق ومراقبة الأعطال.",
    "modules": [
      {
        "title": "Network Design & Routing",
        "desc": "إنشاء بنية شبكية مدروسة.",
        "tags": [
          "TCP/IP",
          "VLAN",
          "Routing"
        ],
        "tasks": [
          "رسم مخطط شبكة لمكتب افتراضي",
          "تخطيط Subnets و VLANs",
          "إعداد Inter-VLAN Routing في المحاكي",
          "اختبار DHCP و DNS",
          "توثيق IP Address Plan"
        ]
      },
      {
        "title": "Operations & Troubleshooting",
        "desc": "تشخيص الأعطال بشكل منهجي.",
        "tags": [
          "Packet Tracer",
          "Wireshark",
          "Monitoring"
        ],
        "tasks": [
          "محاكاة فقد اتصال بين شبكتين",
          "قراءة حزم DNS/TCP في مختبر",
          "جمع أدلة قبل تعديل الإعداد",
          "إصلاح Routing Issue تجريبي",
          "توثيق Incident Runbook"
        ]
      },
      {
        "title": "Network Security & Handover",
        "desc": "إجراءات حماية الشبكة وتسليمها.",
        "tags": [
          "ACL",
          "Segmentation",
          "Hardening"
        ],
        "tasks": [
          "تطبيق ACL داخل المختبر",
          "التحقق من مبدأ Least Privilege",
          "إعداد نسخة احتياطية للإعدادات",
          "تقديم Network Diagram نهائي",
          "تسليم اختبار قبول للشبكة"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "cloud": {
    "name": "Cloud & DevOps Operations",
    "role": "Junior Cloud / DevOps Engineer",
    "emoji": "☁️",
    "project": "نشر تطبيق تجريبي باستخدام Docker و CI/CD على بيئة معزولة أو مجانية، مع مراقبة وصلاحيات وتعليمات استعادة.",
    "modules": [
      {
        "title": "Linux & Containers",
        "desc": "فهم بيئة تشغيل التطبيق.",
        "tags": [
          "Linux",
          "Docker",
          "Networking"
        ],
        "tasks": [
          "إعداد تطبيق للعمل داخل container",
          "إنشاء Dockerfile متعدد المراحل",
          "تشغيل خدمة وقاعدة بيانات محلياً",
          "إدارة Environment Variables بأمان",
          "فحص health endpoint"
        ]
      },
      {
        "title": "CI/CD & Infrastructure",
        "desc": "أتمتة الاختبارات والإصدار.",
        "tags": [
          "GitHub Actions",
          "CI/CD",
          "IaC"
        ],
        "tasks": [
          "كتابة workflow لاختبارات المشروع",
          "إعداد build artifact قابل للتكرار",
          "تعريف تكوين بيئة تطوير",
          "إضافة فحص أخطاء configuration",
          "محاكاة rollback من إصدار خاطئ"
        ]
      },
      {
        "title": "Reliability & Deployment",
        "desc": "تشغيل الخدمة ومتابعتها.",
        "tags": [
          "Cloud Basics",
          "Logs",
          "Monitoring"
        ],
        "tasks": [
          "تطبيق أقل الصلاحيات في بيئة تدريب",
          "تفعيل سجلات وأخطاء التطبيق",
          "اختبار استعادة بيانات تجريبية",
          "إنشاء Runbook لحادث توقف",
          "تقديم Deployment Demo"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "mobile": {
    "name": "تطوير تطبيقات الهاتف",
    "role": "Junior Flutter Developer",
    "emoji": "📱",
    "project": "تطبيق موبايل لإدارة الحجوزات أو المهام، يحتوي على واجهات متجاوبة وتكامل API وحفظ محلي واختبارات.",
    "modules": [
      {
        "title": "Flutter UI",
        "desc": "بناء واجهة تطبيق قابلة للاستخدام.",
        "tags": [
          "Dart",
          "Flutter",
          "Widgets"
        ],
        "tasks": [
          "تحويل Wireframes إلى Screens",
          "بناء Navigation وحالات الواجهة",
          "ضبط استجابة الشاشات المختلفة",
          "إنشاء Form validation",
          "تطبيق Design System مبسط"
        ]
      },
      {
        "title": "API & State Management",
        "desc": "تنفيذ منطق تطبيق حقيقي.",
        "tags": [
          "REST",
          "State",
          "Local Storage"
        ],
        "tasks": [
          "ربط التطبيق بـ API تدريبية",
          "التعامل مع loading/error/empty",
          "حفظ إعدادات محلية",
          "إضافة إدارة حالة منظمة",
          "اختبار اتصال بطيء أو انقطاع"
        ]
      },
      {
        "title": "Testing & Release",
        "desc": "تسليم نسخة قابلة للتجربة.",
        "tags": [
          "Widget Tests",
          "Debug APK",
          "QA"
        ],
        "tasks": [
          "إنشاء اختبارات واجهة أساسية",
          "إصلاح 3 Bugs ضمن المهام",
          "التأكد من أذونات مناسبة",
          "إنتاج Debug APK مع تعليمات تشغيل",
          "عرض Demo وتوثيق النتائج"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "iot": {
    "name": "إنترنت الأشياء والأنظمة المدمجة",
    "role": "Junior IoT Developer",
    "emoji": "🔌",
    "project": "نموذج IoT لمراقبة حرارة أو بيئة مختبرية باستخدام متحكم ومحاكاة Sensor، مع Dashboard وتنبيهات وتوثيق.",
    "modules": [
      {
        "title": "Embedded Programming",
        "desc": "برمجة متحكم ومجسات آمنة.",
        "tags": [
          "ESP32",
          "C/C++",
          "Sensors"
        ],
        "tasks": [
          "قراءة مدخلات حساس أو محاكي",
          "إضافة معايرة ومعالجة حالات فشل",
          "تنظيم الكود إلى وحدات",
          "تجربة نقل بيانات دورية",
          "تسجيل أخطاء اتصال تجريبية"
        ]
      },
      {
        "title": "Connectivity & Backend",
        "desc": "نقل القراءات إلى خدمة محلية.",
        "tags": [
          "MQTT",
          "Wi-Fi",
          "API"
        ],
        "tasks": [
          "إعداد اتصال MQTT محلي",
          "إرسال بيانات بتنسيق JSON",
          "التحقق من بيانات الاستقبال",
          "إدارة reconnect بعد انقطاع",
          "فصل أسرار الاتصال عن الكود"
        ]
      },
      {
        "title": "Monitoring & Productization",
        "desc": "تحويل النموذج إلى منتج توضيحي.",
        "tags": [
          "Dashboard",
          "Alerts",
          "Testing"
        ],
        "tasks": [
          "عرض رسم زمني لقراءات الحساس",
          "إنشاء تنبيه عند حد معين",
          "اختبار انقطاع الاتصال",
          "كتابة مخطط توصيل ومخاطر السلامة",
          "تقديم Demo موثق"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "qa": {
    "name": "ضمان جودة البرمجيات",
    "role": "Junior QA Engineer",
    "emoji": "🧪",
    "project": "إعداد وتنفيذ خطة اختبار لتطبيق ويب تجريبي مع حالات اختبار و Bug Reports وأتمتة مسارات أساسية.",
    "modules": [
      {
        "title": "Manual QA & Test Design",
        "desc": "تحليل المتطلبات وكتابة اختبارات قوية.",
        "tags": [
          "Test Cases",
          "Requirements",
          "Exploratory"
        ],
        "tasks": [
          "قراءة User Stories وإنشاء سيناريوهات",
          "تصميم Positive/Negative Test Cases",
          "إعداد Test Data",
          "تنفيذ Exploratory Testing",
          "كتابة Traceability Matrix"
        ]
      },
      {
        "title": "API & Automation Testing",
        "desc": "تسريع عمليات التحقق.",
        "tags": [
          "Postman",
          "Playwright",
          "Regression"
        ],
        "tasks": [
          "إعداد Postman Collection واختبارات",
          "تأليف E2E Smoke Test",
          "التحقق من أخطاء الصلاحيات في بيئة اختبار",
          "تشغيل الاختبارات وتوثيق النتائج",
          "تحديث الاختبارات بعد إصلاح Bug"
        ]
      },
      {
        "title": "Defect Lifecycle & Release",
        "desc": "إدارة دورة العيب والتسليم.",
        "tags": [
          "Jira",
          "Bug Reports",
          "QA Summary"
        ],
        "tasks": [
          "إنشاء تقارير عيوب قابلة لإعادة الإنتاج",
          "تحديد severity و priority",
          "التحقق من الإصلاح وإغلاق التذكرة",
          "تلخيص نتائج Regression",
          "إصدار QA Sign-off مشروط بالمعايير"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  },
  "game": {
    "name": "تطوير الألعاب التفاعلية",
    "role": "Junior Gameplay Developer",
    "emoji": "🎮",
    "project": "إنشاء لعبة 2D صغيرة قابلة للعب تتضمن مهاماً ومراحل ومؤشرات أداء واختبارات Playtesting.",
    "modules": [
      {
        "title": "Core Gameplay",
        "desc": "إنتاج تجربة لعب بسيطة.",
        "tags": [
          "Unity / Godot",
          "C# / GDScript",
          "2D"
        ],
        "tasks": [
          "إنشاء حركة اللاعب والاستجابة للإدخال",
          "بناء Level صغير",
          "تنفيذ نظام نقاط ومهام",
          "تطبيق حالات الفوز والخسارة",
          "تنظيم المشاهد والكود"
        ]
      },
      {
        "title": "Game Systems & UX",
        "desc": "تحسين التجربة الأساسية.",
        "tags": [
          "UI",
          "Game State",
          "Assets"
        ],
        "tasks": [
          "إضافة واجهات HUD",
          "تنفيذ حفظ التقدم محلياً",
          "تحسين feedback المرئي والصوتي",
          "تطبيق صعوبات بسيطة",
          "تنظيم أصول اللعبة بشكل قانوني"
        ]
      },
      {
        "title": "Testing & Shipping",
        "desc": "إصدار نسخة يمكن تجربتها.",
        "tags": [
          "Playtesting",
          "Build",
          "Bug Fixing"
        ],
        "tasks": [
          "تنفيذ جلسة Playtest موثقة",
          "جمع الملاحظات وترتيبها",
          "معالجة 3 مشكلات لعب",
          "إنتاج Build تجريبي",
          "كتابة Postmortem مختصر"
        ]
      }
    ],
    "note": "",
    "artifacts": "GitHub Repository • Task Board • Working Demo • Technical Report"
  }
};

/** Academic majors in the order they appear in the V4 selector. */
export const ACADEMIC_MAJORS = [
  {
    "value": "cs",
    "label": "علم الحاسوب — Computer Science"
  },
  {
    "value": "se",
    "label": "هندسة البرمجيات — Software Engineering"
  },
  {
    "value": "cy",
    "label": "الأمن السيبراني — Cybersecurity"
  },
  {
    "value": "pen",
    "label": "الاختراق الأخلاقي والأمن الهجومي — Ethical Hacking"
  },
  {
    "value": "netsec",
    "label": "أمن الشبكات والمعلومات — Network & Information Security"
  },
  {
    "value": "ai",
    "label": "الذكاء الاصطناعي — Artificial Intelligence"
  },
  {
    "value": "ds",
    "label": "علم البيانات — Data Science"
  },
  {
    "value": "dsa",
    "label": "علم البيانات والذكاء الاصطناعي — Data Science & AI"
  },
  {
    "value": "dataeng",
    "label": "هندسة البيانات — Data Engineering"
  },
  {
    "value": "bi",
    "label": "ذكاء الأعمال وتحليل البيانات — Business Intelligence"
  },
  {
    "value": "it",
    "label": "تكنولوجيا المعلومات — Information Technology"
  },
  {
    "value": "mis",
    "label": "نظم المعلومات الإدارية — MIS"
  },
  {
    "value": "cis",
    "label": "نظم المعلومات الحاسوبية — CIS"
  },
  {
    "value": "is",
    "label": "نظم المعلومات — Information Systems"
  },
  {
    "value": "network",
    "label": "شبكات الحاسوب — Computer Networks"
  },
  {
    "value": "cloud",
    "label": "الحوسبة السحابية — Cloud Computing"
  },
  {
    "value": "devops",
    "label": "الحوسبة والأنظمة / DevOps"
  },
  {
    "value": "web",
    "label": "تطوير الويب — Web Development"
  },
  {
    "value": "mobile",
    "label": "تطوير تطبيقات الهاتف — Mobile Development"
  },
  {
    "value": "game",
    "label": "تطوير الألعاب — Game Development"
  },
  {
    "value": "iot",
    "label": "إنترنت الأشياء — Internet of Things"
  },
  {
    "value": "embedded",
    "label": "الأنظمة المدمجة — Embedded Systems"
  },
  {
    "value": "computereng",
    "label": "هندسة الحاسوب — Computer Engineering"
  },
  {
    "value": "qa",
    "label": "ضمان جودة البرمجيات — Software QA"
  },
  {
    "value": "otherit",
    "label": "تخصص تقني آخر — المسار المناسب حسب المهارات"
  }
];

/** Academic major key -> career track family key. */
export const MAJOR_TO_TRACK = {
  "cs": "backend",
  "se": "fullstack",
  "cy": "pentest",
  "pen": "pentest",
  "netsec": "pentest",
  "ai": "ai",
  "ds": "data",
  "dsa": "ai",
  "dataeng": "dataeng",
  "bi": "data",
  "it": "it",
  "mis": "data",
  "cis": "fullstack",
  "is": "data",
  "network": "network",
  "cloud": "cloud",
  "devops": "cloud",
  "web": "fullstack",
  "mobile": "mobile",
  "game": "game",
  "iot": "iot",
  "embedded": "iot",
  "computereng": "iot",
  "qa": "qa",
  "otherit": "backend"
};

export const UNIVERSITIES = [
  "الجامعة الأردنية",
  "جامعة العلوم والتكنولوجيا الأردنية",
  "جامعة اليرموك",
  "الجامعة الهاشمية",
  "جامعة البلقاء التطبيقية",
  "جامعة آل البيت",
  "جامعة مؤتة",
  "جامعة الحسين بن طلال",
  "جامعة الطفيلة التقنية",
  "الجامعة الألمانية الأردنية",
  "جامعة الأميرة سمية للتكنولوجيا",
  "جامعة عمان الأهلية",
  "جامعة العلوم التطبيقية الخاصة",
  "جامعة الزيتونة الأردنية",
  "جامعة الإسراء",
  "جامعة عمان العربية",
  "جامعة الشرق الأوسط",
  "جامعة العقبة للتكنولوجيا",
  "جامعة جدارا",
  "جامعة فيلادلفيا"
];
