import { useEffect, useMemo, useState } from 'react';

const slides = [
  {
    image: '/images/slider-baz.jpg',
    alt: 'БАЗ — для дорог и тяжелого бездорожья. Гарантия 24 месяца или 150 000 пробега, 5 видов кабин, управление всеми осями и независимая подвеска.',
  },
  {
    image: '/images/slider-kamaz.jpg',
    alt: 'Теперь с нами КАМАЗ — продажа, запчасти, сервис.',
  },
];

const certificates = [
  {
    image: '/images/eland-2026-033.png',
    pdf: '/documents/eland-2026-033.pdf',
    title: 'ООО «Эланд», Иркутск — 2S автомобили',
  },
  {
    image: '/images/kamaz-dealer.png',
    pdf: '/documents/kamaz-dealer.pdf',
    title: 'ОП «ИлимСкан», Усть-Илимск — 2S запасные части',
  },
];

function CertificateSlider() {
  const [current, setCurrent] = useState(0);
  const changeSlide = (offset) =>
    setCurrent((value) => (value + offset + certificates.length) % certificates.length);

  return (
    <div
      className="certificate-slider"
      role="region"
      aria-label="Свидетельства официального дилера КАМАЗ"
      aria-roledescription="карусель"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          changeSlide(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      {certificates.map((certificate, index) => (
        <a
          key={certificate.pdf}
          className="certificate-slide"
          href={certificate.pdf}
          target="_blank"
          rel="noopener noreferrer"
          hidden={index !== current}
          aria-label={`${certificate.title}. Открыть свидетельство в PDF`}
        >
          <img src={certificate.image} alt={`Свидетельство КАМАЗ: ${certificate.title}`} width="843" height="595" loading="lazy" />
        </a>
      ))}
      <div className="certificate-caption" aria-live="polite" aria-atomic="true">
        <strong>{certificates[current].title}</strong>
        <span>Нажмите на свидетельство, чтобы открыть PDF</span>
      </div>
      <div className="certificate-controls">
        <button type="button" onClick={() => changeSlide(-1)} aria-label="Предыдущее свидетельство">←</button>
        <div className="certificate-dots" aria-label="Выбор свидетельства">
          {certificates.map((certificate, index) => (
            <button
              type="button"
              key={certificate.pdf}
              onClick={() => setCurrent(index)}
              aria-label={`Показать свидетельство ${index + 1}: ${certificate.title}`}
              aria-current={index === current ? 'true' : undefined}
            />
          ))}
        </div>
        <span>{current + 1} / {certificates.length}</span>
        <button type="button" onClick={() => changeSlide(1)} aria-label="Следующее свидетельство">→</button>
      </div>
    </div>
  );
}

const catalogs = [
  [
    ['КАМАЗ-54901', 'Седельный тягач', '4×2', '449 л.с.', 'от 14 900 000 ₽'],
    ['КАМАЗ-65952', 'Самосвал', '6×4', '25 т', 'от 12 400 000 ₽'],
    ['КАМАЗ-43118', 'Бортовой автомобиль', '6×6', '300 л.с.', 'от 8 700 000 ₽'],
    ['КАМАЗ-65115', 'Самосвал', '6×4', '12 м³', 'от 9 300 000 ₽'],
  ],
  [
    ['Автоцистерна АЦ-10', 'На шасси КАМАЗ-43118', '6×6', '10 м³', 'Цена по запросу'],
    ['Автобетоносмеситель', 'На шасси КАМАЗ-6520', '6×4', '10 м³', 'Цена по запросу'],
    ['Бортовой с КМУ', 'На шасси КАМАЗ-65117', '6×4', '16 т·м', 'Цена по запросу'],
    ['Мусоровоз', 'На шасси КАМАЗ-53605', '4×2', '18 м³', 'Цена по запросу'],
  ],
  [
    ['НЕФАЗ-9509', 'Полуприцеп-самосвал', '3 оси', '28 м³', 'Цена по запросу'],
    ['НЕФАЗ-93341', 'Бортовой полуприцеп', '3 оси', '30 т', 'Цена по запросу'],
    ['НЕФАЗ-8560', 'Прицеп-самосвал', '2 оси', '12 т', 'Цена по запросу'],
  ],
];

const branches = [
  [
    'Иркутск: «Эланд»',
    '664048, ул. Ярославского, 302',
    '+7 (3952) 55-33-10',
    'Отдел сервиса: без выходных с 9:00 до 18:00',
    'Остальные отделы: пн-пт с 9:00 до 18:00',
    'Грузовой кузовной цех: пн-пт с 9:00 до 18:00',
  ],
  [
    'Братск: «БратскСкан» + Кузовной грузовой цех',
    '665703, мкн Гидростроитель, ул. Радищева, 2ж',
    '+7 (3435) 00-00-00',
    'Отдел продаж техники: Пн-пт с 9:00 до 18:00',
    'Отдел сервиса «БратскСкан»: без выходных с 9:00 до 21:00',
    'Отдел сервиса «АнгараСкан»: без выходных с 9:00 до 21:00',
  ],
  [
    'Усть-Илимск: «ИлимСкан»',
    '666685, шоссе им М.И. Бусыгина, зд. 66',
    '+7 (3952) 55-33-10, доб. 62',
    'Отдел сервиса: круглосуточно, без выходных',
  ],
];

// Latitude, longitude from https://scaneland.ru/contacts/.
const branchCoordinates = {
  'Иркутск': [52.347976583686005, 104.14555721827683],
  'Братск': [56.274001, 101.858074],
  'Усть-Илимск': [57.98234656658093, 102.77745549999989],
};

function BranchMap({ branch }) {
  const city = branch[0].split(':')[0];
  const address = `${city}, ${branch[1]}`;
  const [latitude, longitude] = branchCoordinates[city];
  // The map uses longitude first; routing uses latitude first.
  const point = `${longitude},${latitude}`;
  const mapQuery = new URLSearchParams({
    ll: point,
    pt: `${point},pm2rdm`,
    z: '16',
    lang: 'ru_RU',
  });
  const routeQuery = new URLSearchParams({ rtext: `~${latitude},${longitude}`, rtt: 'auto' });

  return (
    <div className="branch-map">
      <iframe
        key={address}
        src={`https://yandex.ru/map-widget/v1/?${mapQuery}`}
        title={`Карта проезда: ${branch[0]}`}
        width="100%"
        height="320"
        loading="lazy"
        allowFullScreen
      />
      <a href={`https://yandex.ru/maps/?${routeQuery}`} target="_blank" rel="noopener noreferrer">
        Построить маршрут в Яндекс Картах ↗
      </a>
    </div>
  );
}

const scrollTo = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const newsDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function Placeholder({ label, className = '', src }) {
  //   return src ? (
  //     <img src={src} alt="" style={{
  //   width: '100%',
  //   objectFit: 'contain',
  //   display: 'block',
  //   marginLeft: 'auto',
  // }}/>
  //   )
  //     :
  return (
    <div className={`placeholder ${className}`} role="img" aria-label={label}>
      <span>ФОТО</span>
      <small>{label ? label : 'уточнить'}</small>
    </div>
  );
}

function App() {
  const dealerStatus = '2S автотехника';
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState(0);
  const [branch, setBranch] = useState(0);
  const [sent, setSent] = useState(false);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [news, setNews] = useState([]);
  const [newsState, setNewsState] = useState('loading');

  const showVehicles = dealerStatus === '3S' || dealerStatus === '2S автотехника';
  const showParts = true;
  const showService = dealerStatus !== 'Дистрибьютор';

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/news?limit=6', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Новости временно недоступны');
        setNews(result.news || []);
        setNewsState('success');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setNewsState('error');
      });
    return () => controller.abort();
  }, []);

  const nav = useMemo(
    () => [
      ...(showVehicles ? [['Техника', 'catalog']] : []),
      ...(showParts ? [['Запасные части', 'parts']] : []),
      ...(showService ? [['Сервис и гарантия', 'service']] : []),
      ...(showVehicles ? [['Финансовый сервис', 'finance']] : []),
      ['Контакты', 'contacts'],
      ['Новости', 'news'],
      ['О компании', 'about'],
    ],
    [showVehicles, showParts, showService],
  );

  const goFeedback = () => {
    setSent(false);
    setSubmitState('idle');
    setSubmitError('');
    scrollTo('feedback');
  };
  const submit = async (event) => {
    event.preventDefault();
    setSubmitState('submitting');
    setSubmitError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const payload = {
      ...values,
      branchId: branch,
      consent: values.consent === 'on',
    };
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Не удалось отправить заявку.');
      form.reset();
      setSent(true);
      setSubmitState('success');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(error.message || 'Не удалось отправить заявку.');
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="container topbar-inner">
          <span>Иркутск, ул. Ярославского, 302</span>
          <span>Ежедневно 9:00–21:00 · +7 (3952) 56-70-76</span>
        </div>
      </div>
      <header className="header">
        <div className="container header-main">
          <a className="brand" href="#top" aria-label="Эланд">
            <img
              className="brand-logo"
              src="/images/kamaz-center.jpg"
              alt="КАМАЗ Центр"
              width="770"
              height="1350"
            />
            <span>
              <strong>ООО "Эланд"</strong>
              <small>Официальный дилер ПАО «КАМАЗ»</small>
            </span>
          </a>
          <button className="button" onClick={() => goFeedback()}>
            Обратный звонок
          </button>
          <button
            className="menu-button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            Меню
          </button>
        </div>
        <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Основная навигация">
          <div className="container nav-inner">
            {nav.map(([label, id]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-label="Рекламные предложения" aria-roledescription="карусель">
          <div className="hero-slides">
            {slides.map((item, i) => (
              <img
                key={item.image}
                className="hero-banner"
                src={item.image}
                alt={item.alt}
                width="2200"
                height="800"
                hidden={i !== slide}
                fetchPriority={i === 0 ? 'high' : 'auto'}
              />
            ))}
          </div>
          <div className="dots hero-dots" aria-label="Выбор слайда">
            {slides.map((_, i) => (
              <button
                key={i}
                className={i === slide ? 'active' : ''}
                onClick={() => setSlide(i)}
                aria-label={`Показать слайд ${i + 1}`}
                aria-current={i === slide}
              />
            ))}
          </div>
        </section>

        {showVehicles && (
          <div className="container leasing-banner-wrap">
            <a className="leasing-banner" href="/leasing/">
              <img src="/images/kamaz-leasing-logo.png" alt="КАМАЗ — ЛИЗИНГ. Машина вашего бизнеса" width="401" height="116" />
              <div>
                <strong>Лизинг от производителя</strong>
                <span>Программы и актуальные предложения КАМАЗ — ЛИЗИНГ</span>
              </div>
              <span className="button">Подобрать программу →</span>
            </a>
          </div>
        )}

        <section className="promo">
          <div className="container card-grid compact">
            {[
              ['Сервис', 'Сезонное ТО −15% на запчасти'],
              ['Трейд-ин', 'Обмен старой техники на новую'],
            ].map(([tag, title]) => (
              <article className="promo-card" key={tag}>
                <span>{tag}</span>
                <strong>{title}</strong>
                <small>Подробнее →</small>
              </article>
            ))}
          </div>
        </section>

        {showVehicles && (
          <section id="catalog" className="section">
            <div className="container">
              <SectionTitle eyebrow="Каталог продукции" title="Техника в наличии и под заказ" />
              <div className="tabs" role="tablist">
                {['Автотехника', 'Спецавтотехника', 'Прицепная техника'].map((label, i) => (
                  <button
                    role="tab"
                    aria-selected={tab === i}
                    className={tab === i ? 'active' : ''}
                    onClick={() => setTab(i)}
                    key={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="card-grid products">
                {catalogs[tab].map((item) => (
                  <article className="product" key={item[0]}>
                    <Placeholder label={`Фото ${item[0]}`} />
                    <div className="product-body">
                      <small>{item[1]}</small>
                      <h3>{item[0]}</h3>
                      <dl>
                        <div>
                          <dt>Характеристика</dt>
                          <dd>{item[2]}</dd>
                        </div>
                        <div>
                          <dt>Показатель</dt>
                          <dd>{item[3]}</dd>
                        </div>
                      </dl>
                      <footer>
                        <strong>{item[4]}</strong>
                        <button className="link-button" onClick={() => goFeedback()}>
                          Заказать звонок
                        </button>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {showVehicles && (
          <section id="finance" className="section blue">
            <div className="container split">
              <div>
                <SectionTitle eyebrow="КАМАЗ-ЛИЗИНГ" title="Лизинг от производителя" />
                <p>
                  Программы приобретения техники КАМАЗ в лизинг от производителя.
                  Актуальные предложения, условия финансирования и помощь в оформлении —
                  на странице КАМАЗ — ЛИЗИНГ.
                </p>
                <a
                  className="button light"
                  href="/leasing/"
                >
                  Программы и предложения
                </a>
              </div>
              <a className="leasing-logo-card" href="/leasing/" aria-label="Открыть страницу КАМАЗ — ЛИЗИНГ">
                <img src="/images/kamaz-leasing-logo.png" alt="КАМАЗ — ЛИЗИНГ. Машина вашего бизнеса" width="401" height="116" loading="lazy" />
              </a>
            </div>
          </section>
        )}

        {showParts && (
          <section id="parts" className="section muted">
            <div className="container">
              <SectionTitle eyebrow="Запасные части" title="Оригинальные запасные части КАМАЗ" />
              <p className="parts-intro">
                Подберите детали для вашей техники в каталоге КАМАЗ. Перед покупкой проверьте
                признаки подлинности — это поможет выбрать оригинальные запчасти.
              </p>
              <div className="parts-grid">
                <a
                  className="parts-card"
                  href="http://azkamaz.ru/parts/zch/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div>
                    <h3>Каталог запчастей</h3>
                    <p>Номера деталей и их применяемость для техники КАМАЗ.</p>
                  </div>
                  <span className="parts-arrow" aria-hidden="true">↗</span>
                </a>
                <a
                  className="parts-card"
                  href="https://www.kamaz.ru/production/parts/protection-against-counterfeiting/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div>
                    <h3>Защита от контрафакта</h3>
                    <p>Как проверить упаковку и маркировку оригинальных запчастей.</p>
                  </div>
                  <span className="parts-arrow" aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </section>
        )}

        {showService && (
          <section id="service" className="section">
            <div className="container">
              <SectionTitle eyebrow="Сервис и гарантия" title="Сертифицированный сервисный центр" />
              <p>Гарантийное и постгарантийное обслуживание техники КАМАЗ.</p>
              <div className="service-list">
                {[
                  ['Техническое обслуживание ТО-1', 'от 8 700 ₽'],
                  ['Компьютерная диагностика', '2 900 ₽'],
                  ['Ремонт двигателя', 'от 2 900 ₽/н·ч'],
                  ['Ремонт КПП и сцепления', 'от 2 900 ₽/н·ч'],
                ].map(([name, price]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>{price}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="about" className="section muted">
          <div className="container split">
            <div>
              <SectionTitle eyebrow="О компании" title="Официальный дилер КАМАЗ в Иркутске" />
              <p>
                Продажа техники, оригинальных запасных частей, гарантийное и постгарантийное
                обслуживание.
              </p>
              <div className="facts">
                <b>
                  18 лет<small>на рынке</small>
                </b>
                <b>
                  4<small>дилерских центра</small>
                </b>
                <b>
                  4<small>поста сервиса</small>
                </b>
              </div>
            </div>
            <CertificateSlider />
          </div>
        </section>

        <section id="news" className="section">
          <div className="container">
            <SectionTitle eyebrow="Пресс-центр" title="Новости ПАО «КАМАЗ»" />
            {newsState === 'loading' && (
              <p className="news-status">Загружаем актуальные новости…</p>
            )}
            {newsState === 'error' && (
              <p className="news-status">
                Не удалось загрузить ленту.{' '}
                <a href="https://www.kamaz.ru/press/releases/" target="_blank" rel="noreferrer">
                  Открыть новости на kamaz.ru →
                </a>
              </p>
            )}
            {newsState === 'success' && news.length === 0 && (
              <p className="news-status">В ленте пока нет публикаций.</p>
            )}
            <div className="card-grid">
              {news.map((item) => (
                <a
                  className="news-card"
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  key={item.id}
                >
                  <small>
                    {newsDate.format(new Date(item.publishedAt))} · {item.source}
                  </small>
                  <strong>{item.title}</strong>
                  {item.description && <p>{item.description}</p>}
                  <span>Читать на kamaz.ru →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="feedback" className="section blue">
          <div className="container split feedback">
            <div>
              <SectionTitle
                eyebrow="Обратная связь"
                title="Обратный звонок"
              />
              <p>
                Оставьте имя и телефон — мы перезвоним вам в рабочее время.
              </p>
            </div>
            <div className="form-card">
              {sent ? (
                <div className="success">
                  <h3>Заявка отправлена</h3>
                  <p>Мы перезвоним вам в рабочее время.</p>
                  <button
                    className="button"
                    onClick={() => {
                      setSent(false);
                      setSubmitState('idle');
                    }}
                  >
                    Новая заявка
                  </button>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <label>
                    Имя
                    <input name="name" autoComplete="name" minLength="2" maxLength="100" required />
                  </label>
                  <label>
                    Телефон
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      placeholder="+7 (___) ___-__-__"
                    />
                  </label>
                  <label>
                    Комментарий
                    <textarea name="message" rows="3" maxLength="2000" />
                  </label>
                  <label className="consent">
                    <input name="consent" type="checkbox" required />
                    Согласен на обработку персональных данных
                  </label>
                  <input
                    className="honeypot"
                    name="website"
                    tabIndex="-1"
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <button className="button" type="submit" disabled={submitState === 'submitting'}>
                    {submitState === 'submitting' ? 'Отправляем…' : 'Заказать звонок'}
                  </button>
                  {submitError && (
                    <p className="form-error" role="alert">
                      {submitError}
                    </p>
                  )}
                  <small>Данные сохраняются в защищённой базе заявок.</small>
                </form>
              )}
            </div>
          </div>
        </section>

        <section id="contacts" className="section">
          <div className="container">
            <SectionTitle eyebrow="Контакты" title="Дилерские центры" />
            <p>
              <a href="#feedback" onClick={() => goFeedback()}>Заказать обратный звонок</a>
            </p>
            <div className="contacts">
              <div className="branch-list">
                {branches.map((item, i) => (
                  <button
                    className={branch === i ? 'active' : ''}
                    onClick={() => setBranch(i)}
                    key={item[0]}
                  >
                    <strong>{item[0]}</strong>
                    <span>{item[1]}</span>
                  </button>
                ))}
              </div>
              <div className="contact-card">
                <BranchMap branch={branches[branch]} />
                <h3>{branches[branch][0]}</h3>
                <p>{branches[branch][1]}</p>
                <a href={`tel:${branches[branch][2].replace(/[^+\d]/g, '')}`}>
                  {branches[branch][2]}
                </a>
                <p>{branches[branch][3]}</p>
                <p>{branches[branch][4]}</p>
                <p>{branches[branch][5]}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <strong>Эланд</strong>
          <span>Официальный дилер ПАО «КАМАЗ»</span>
          <nav className="footer-links" aria-label="Официальные ресурсы КАМАЗ">
            <div></div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
                gap: '16px',
              }}
            >
              <a href="https://kamaz.ru/" target="_blank" rel="noopener noreferrer">
                Сайт ПАО «КАМАЗ» →
              </a>
              <a href="https://azkamaz.ru/" target="_blank" rel="noopener noreferrer">
                Сайт ООО «АвтоЗапчасть КАМАЗ» →
              </a>
            </div>
          </nav>
          <span>Copyright © 2026. Все права защищены. ООО «Эланд»</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="section-title">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

export default App;
