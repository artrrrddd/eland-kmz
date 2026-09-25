import { useEffect, useMemo, useState } from 'react';

const slides = [
  { tag: 'Акция до 31 октября', title: 'Магистральный тягач КАМАЗ-54901 в лизинг от 0% аванса', text: 'Программа «Лизинг от производителя» для юридических лиц и ИП.' },
  { tag: 'Сервис', title: 'Сезонное ТО со скидкой 15% на оригинальные запчасти', text: 'Подготовьте технику к зиме в сертифицированном сервисном центре КАМАЗ.' },
  { tag: 'Спецтехника', title: 'Самосвалы и шасси КАМАЗ в наличии на складе', text: 'Более 40 единиц техники готовы к отгрузке. Трейд-ин и кредитование.' },
];

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
  ['Иркутск: «Эланд»', '664048, ул. Ярославского, 302', '+7 (3952) 55-33-10', 'Отдел сервиса: без выходных с 9:00 до 18:00', 'Остальные отделы: пн-пт с 9:00 до 18:00', 'Грузовой кузовной цех: пн-пт с 9:00 до 18:00'],
  ['Братск: «БратскСкан» + Кузовной грузовой цех', '665703, мкн Гидростроитель, ул. Радищева, 2ж', '+7 (3435) 00-00-00', 'Отдел продаж техники: Пн-пт с 9:00 до 18:00', 'Отдел сервиса «БратскСкан»: без выходных с 9:00 до 21:00', 'Отдел сервиса «АнгараСкан»: без выходных с 9:00 до 21:00'],
  ['Усть-Илимск: «ИлимСкан»', '666685, шоссе им М.И. Бусыгина, зд. 66', '+7 (3952) 55-33-10, доб. 62', 'Отдел сервиса: круглосуточно, без выходных'],
];

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const newsDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
    return <div className={`placeholder ${className}`} role="img" aria-label={label}><span>ФОТО</span><small>{label ? label : 'уточнить'}</small></div>;
  }

function App() {
  const dealerStatus = '2S автотехника';
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState(0);
  const [formTab, setFormTab] = useState(0);
  const [branch, setBranch] = useState(0);
  const [sent, setSent] = useState(false);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [news, setNews] = useState([]);
  const [newsState, setNewsState] = useState('loading');

  const showVehicles = dealerStatus === '3S' || dealerStatus === '2S автотехника';
  const showParts = ['3S', '2S запчасти', 'Дистрибьютор'].includes(dealerStatus);
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

  const nav = useMemo(() => [
    ...(showVehicles ? [['Техника', 'catalog']] : []),
    ...(showParts ? [['Запчасти', 'parts']] : []),
    ...(showService ? [['Сервис', 'service']] : []),
    ['О компании', 'about'], ['Новости', 'news'], ['Контакты', 'contacts'],
  ], [showVehicles, showParts, showService]);

  const goFeedback = (index, model = '') => {
    setFormTab(index);
    setSelectedModel(model);
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
    const types = ['question', 'callback', 'test_drive', 'service'];
    const payload = {
      ...values,
      type: selectedModel && formTab === 2 ? 'commercial_offer' : types[formTab],
      model: values.model || selectedModel,
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

  return <div className="app">
    <div className="topbar"><div className="container topbar-inner"><span>Иркутск, ул. Ярославского, 302</span><span>Пн–Пт 8:00–20:00 · +7 (343) 000-00-00</span></div></div>
    <header className="header">
      <div className="container header-main">
        <a className="brand" href="#top" aria-label="Эланд"><b>КАМАЗ</b><span><strong>"Эланд"</strong><small>Официальный дилер ПАО «КАМАЗ»</small></span></a>
        <button className="button" onClick={() => goFeedback(1)}>Обратный звонок</button>
        <button className="menu-button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>Меню</button>
      </div>
      <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Основная навигация"><div className="container nav-inner">{nav.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}</div></nav>
    </header>

    <main id="top">
      <section className="hero">
        <div className="container hero-inner"><div className="hero-copy"><span className="badge">{slides[slide].tag}</span><h1>{slides[slide].title}</h1><p>{slides[slide].text}</p><div className="hero-actions"><button className="button light" onClick={() => scrollTo('catalog')}>Подробнее</button><div className="dots">{slides.map((_, i) => <button key={i} className={i === slide ? 'active' : ''} onClick={() => setSlide(i)} aria-label={`Показать слайд ${i + 1}`} aria-current={i === slide} />)}</div></div></div><Placeholder label="Рекламный баннер" className="hero-image" /></div>
      </section>

      <section className="promo"><div className="container card-grid compact">{[['Лизинг','КАМАЗ К5 с выгодой до 1,2 млн ₽'],['Сервис','Сезонное ТО −15% на запчасти'],['Трейд-ин','Обмен старой техники на новую']].map(([tag,title]) => <article className="promo-card" key={tag}><span>{tag}</span><strong>{title}</strong><small>Подробнее →</small></article>)}</div></section>

      {showVehicles && <section id="catalog" className="section"><div className="container"><SectionTitle eyebrow="Каталог продукции" title="Техника в наличии и под заказ" /><div className="tabs" role="tablist">{['Автотехника','Спецавтотехника','Прицепная техника'].map((label,i) => <button role="tab" aria-selected={tab === i} className={tab === i ? 'active' : ''} onClick={() => setTab(i)} key={label}>{label}</button>)}</div><div className="card-grid products">{catalogs[tab].map((item) => <article className="product" key={item[0]}><Placeholder label={`Фото ${item[0]}`} /><div className="product-body"><small>{item[1]}</small><h3>{item[0]}</h3><dl><div><dt>Характеристика</dt><dd>{item[2]}</dd></div><div><dt>Показатель</dt><dd>{item[3]}</dd></div></dl><footer><strong>{item[4]}</strong><button className="link-button" onClick={() => goFeedback(2, item[0])}>Запросить КП</button></footer></div></article>)}</div></div></section>}

      {showVehicles && <section className="section blue"><div className="container split"><div><SectionTitle eyebrow="КАМАЗ-ЛИЗИНГ" title="Лизинг от производителя" /><p>Специальные условия на новую технику, субсидированные ставки и оформление в дилерском центре за один визит.</p><a className="button light" href="https://kamazleasing.ru/leasing-offers" target="_blank" rel="noreferrer">Все предложения</a></div><div className="stats">{[['0%','Аванс'],['60 мес','Срок'],['1 день','Решение'],['КАСКО','Страхование']].map(([big,label]) => <div key={label}><b>{big}</b><span>{label}</span></div>)}</div></div></section>}

      {showParts && <section id="parts" className="section muted"><div className="container split"><div><SectionTitle eyebrow="Запасные части" title="Оригинальные запчасти КАМАЗ" /><p>Фирменная упаковка, проверяемый каталожный номер и гарантия производителя.</p><a className="button" href="https://shop.kamaz.ru/catalog/zapasnye_chasti/" target="_blank" rel="noreferrer">Открыть каталог</a></div><Placeholder label="Оригинальные запчасти КАМАЗ" /></div></section>}

      {showService && <section id="service" className="section"><div className="container"><SectionTitle eyebrow="Сервис" title="Сертифицированный сервисный центр" /><div className="service-list">{[['Техническое обслуживание ТО-1','от 8 700 ₽'],['Компьютерная диагностика','2 900 ₽'],['Ремонт двигателя','от 2 900 ₽/н·ч'],['Ремонт КПП и сцепления','от 2 900 ₽/н·ч']].map(([name,price]) => <div key={name}><span>{name}</span><strong>{price}</strong></div>)}</div></div></section>}

      <section id="about" className="section muted"><div className="container split"><div><SectionTitle eyebrow="О компании" title="Официальный дилер КАМАЗ в Иркутске" /><p>Продажа техники, оригинальных запасных частей, гарантийное и постгарантийное обслуживание.</p><div className="facts"><b>18 лет<small>на рынке</small></b><b>2<small>дилерских центра</small></b><b><small>поста сервиса</small></b></div></div><Placeholder label="Свидетельство официального дилера"/></div></section>

      <section id="news" className="section"><div className="container"><SectionTitle eyebrow="Пресс-центр" title="Новости ПАО «КАМАЗ»" />{newsState === 'loading' && <p className="news-status">Загружаем актуальные новости…</p>}{newsState === 'error' && <p className="news-status">Не удалось загрузить ленту. <a href="https://www.kamaz.ru/press/releases/" target="_blank" rel="noreferrer">Открыть новости на kamaz.ru →</a></p>}{newsState === 'success' && news.length === 0 && <p className="news-status">В ленте пока нет публикаций.</p>}<div className="card-grid">{news.map((item) => <a className="news-card" href={item.link} target="_blank" rel="noreferrer" key={item.id}><small>{newsDate.format(new Date(item.publishedAt))} · {item.source}</small><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}<span>Читать на kamaz.ru →</span></a>)}</div></div></section>

      <section id="feedback" className="section blue"><div className="container split feedback"><div><SectionTitle eyebrow="Обратная связь" title="Ответим в течение 15 минут в рабочее время" /><p>Задайте вопрос, получите консультацию или запишитесь на сервис.</p></div><div className="form-card"><div className="form-tabs">{['Вопрос','Консультация','Тест-драйв','Сервис'].map((label,i) => <button type="button" className={formTab === i ? 'active' : ''} onClick={() => { setFormTab(i); setSelectedModel(''); setSent(false); setSubmitError(''); }} key={label}>{label}</button>)}</div>{sent ? <div className="success"><h3>Заявка отправлена</h3><p>Мы сохранили заявку и свяжемся с вами в рабочее время.</p><button className="button" onClick={() => { setSent(false); setSubmitState('idle'); }}>Новая заявка</button></div> : <form onSubmit={submit}><label>Имя<input name="name" autoComplete="name" minLength="2" maxLength="100" required /></label><label>Телефон<input name="phone" type="tel" autoComplete="tel" required placeholder="+7 (___) ___-__-__" /></label>{formTab === 2 && <label>Модель<select name="model" defaultValue={selectedModel || 'КАМАЗ-54901'}><option>КАМАЗ-54901</option><option>КАМАЗ-65952</option><option>КАМАЗ-43118</option><option>КАМАЗ-65115</option></select></label>}{formTab === 3 && <label>VIN или госномер<input name="vehicle" maxLength="100" required /></label>}<label>Комментарий<textarea name="message" rows="3" maxLength="2000" /></label><label className="consent"><input name="consent" type="checkbox" required />Согласен на обработку персональных данных</label><input className="honeypot" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" /><button className="button" type="submit" disabled={submitState === 'submitting'}>{submitState === 'submitting' ? 'Отправляем…' : 'Отправить заявку'}</button>{submitError && <p className="form-error" role="alert">{submitError}</p>}<small>Данные сохраняются в защищённой базе заявок.</small></form>}</div></div></section>

      <section id="contacts" className="section"><div className="container"><SectionTitle eyebrow="Контакты" title="Дилерские центры" /><div className="contacts"><div className="branch-list">{branches.map((item,i) => <button className={branch === i ? 'active' : ''} onClick={() => setBranch(i)} key={item[0]}><strong>{item[0]}</strong><span>{item[1]}</span></button>)}</div><div className="contact-card"><Placeholder label="Схема проезда" /><h3>{branches[branch][0]}</h3><p>{branches[branch][1]}</p><a href={`tel:${branches[branch][2].replace(/[^+\d]/g,'')}`}>{branches[branch][2]}</a><p>{branches[branch][3]}</p><p>{branches[branch][4]}</p><p>{branches[branch][5]}</p></div></div></div></section>
    </main>
    <footer className="footer"><div className="container footer-inner"><strong>Эланд</strong><span>Официальный дилер ПАО «КАМАЗ»</span><nav className="footer-links" aria-label="Официальные ресурсы КАМАЗ"><div>   
    </div>

    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'start', justifyContent: 'center', gap: '16px'}}>
    <a href="https://kamaz.ru/" target="_blank" rel="noopener noreferrer">Сайт ПАО «КАМАЗ» →</a><a href="https://azkamaz.ru/" target="_blank" rel="noopener noreferrer">Сайт ООО «АвтоЗапчасть КАМАЗ» →</a>
    </div>
    
    </nav><span>Copyright © 2026. Все права защищены. ООО «Эланд»</span></div></footer>
  </div>;
}

function SectionTitle({ eyebrow, title }) { return <div className="section-title"><span>{eyebrow}</span><h2>{title}</h2></div>; }

export default App;
