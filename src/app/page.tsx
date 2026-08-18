import Image from "next/image";
import { ArrowDown, ArrowUpRight, Diamond } from "lucide-react";

const whatsappMessage =
  "Olá, Breytilla. Encontrei seu site e gostaria de saber mais sobre a psicoterapia online.";

const whatsappUrl = `https://wa.me/5516992126214?text=${encodeURIComponent(
  whatsappMessage,
)}`;

const recognitionItems = [
  "A ansiedade ocupa espaço demais e torna difícil desacelerar.",
  "A autocobrança faz você sentir que nunca é suficiente.",
  "Sua autoestima parece depender do olhar e da aprovação dos outros.",
  "Relacionamentos e vivências amorosas repetem dores que você gostaria de compreender.",
  "Você sente que se afastou de si e deseja reconhecer suas necessidades novamente.",
];

const focusAreas = [
  "Ansiedade",
  "Autoestima",
  "Relacionamentos",
  "Vivências amorosas",
  "Autoconhecimento",
];

const processSteps = [
  {
    number: "01",
    title: "Primeiro contato",
    text: "Você me chama pelo WhatsApp para tirar dúvidas e conversarmos sobre disponibilidade de agenda.",
  },
  {
    number: "02",
    title: "Encontro online",
    text: "As sessões são individuais e acontecem por videochamada, em horário combinado e ambiente reservado.",
  },
  {
    number: "03",
    title: "Caminho construído juntas",
    text: "O processo é conduzido de forma contínua, respeitando sua singularidade, suas necessidades e seu ritmo.",
  },
];

const faqs = [
  {
    question: "Para quem é a psicoterapia?",
    answer:
      "O atendimento é individual, online e destinado a mulheres adultas (18+) em território brasileiro. A proposta acolhe especialmente questões relacionadas à ansiedade, autoestima, relacionamentos, vivências amorosas e autoconhecimento.",
  },
  {
    question: "Como funciona o atendimento online?",
    answer:
      "As sessões acontecem por videochamada, em dia e horário combinados. Para preservar sua privacidade, é importante estar em um local reservado, com conexão estável e onde você possa falar com tranquilidade.",
  },
  {
    question: "O que acontece no primeiro contato?",
    answer:
      "O WhatsApp é usado para esclarecer dúvidas sobre o funcionamento do atendimento e verificar disponibilidade de agenda. Esse contato inicial não substitui uma sessão de psicoterapia.",
  },
  {
    question: "Como a privacidade é cuidada?",
    answer:
      "O trabalho psicológico observa o sigilo profissional e os princípios éticos da Psicologia. Antes de iniciar, combinaremos os cuidados com os recursos digitais e com o ambiente para favorecer a privacidade durante as sessões.",
  },
  {
    question: "Este canal atende situações de emergência?",
    answer:
      "Não. O site e o WhatsApp profissional não são canais de urgência ou emergência. Em situação de risco imediato, procure uma UPA ou pronto-socorro ou ligue para o SAMU 192. Para apoio emocional, o CVV atende gratuitamente pelo 188.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://breytilla.com.br/#breytilla",
      name: "Breytilla Katyeliny Silva Souza",
      jobTitle: "Psicóloga",
      description:
        "Psicóloga com abordagem em Gestalt-terapia e atendimento individual online para mulheres adultas.",
      url: "https://breytilla.com.br",
      email: "mailto:psibreytillak@gmail.com",
      telephone: "+55 16 99212-6214",
      sameAs: ["https://instagram.com/breytillak"],
      identifier: {
        "@type": "PropertyValue",
        propertyID: "CRP",
        value: "06/180155",
      },
      knowsAbout: [
        "Gestalt-terapia",
        "Ansiedade",
        "Autoestima",
        "Relacionamentos",
        "Autoconhecimento",
      ],
    },
    {
      "@type": "Service",
      "@id": "https://breytilla.com.br/#psicoterapia-online",
      name: "Psicoterapia individual online",
      serviceType: "Psicoterapia individual online em Gestalt-terapia",
      provider: { "@id": "https://breytilla.com.br/#breytilla" },
      areaServed: "Brasil",
      audience: {
        "@type": "PeopleAudience",
        requiredMinAge: 18,
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className="site-header">
        <div className="container header-inner">
          <a className="wordmark" href="#inicio" aria-label="Breytilla — início">
            Brey<em>tilla</em>
          </a>

          <nav className="main-nav" aria-label="Navegação principal">
            <a href="#psicoterapia">Psicoterapia</a>
            <a href="#sobre">Sobre</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>

          <a
            className="button button--header"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar com Breytilla pelo WhatsApp"
          >
            Conversar
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="hero-glow hero-glow--one" aria-hidden="true" />
          <div className="hero-glow hero-glow--two" aria-hidden="true" />

          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Psicoterapia online para mulheres</p>
              <h1 id="hero-title">
                Um espaço de escuta para você <em>voltar a si mesma.</em>
              </h1>
              <p className="hero-lead">
                Psicoterapia individual online, pela abordagem da
                Gestalt-terapia, para mulheres que desejam compreender a
                ansiedade, fortalecer a autoestima e construir relações mais
                conscientes.
              </p>

              <div className="hero-actions">
                <a
                  className="button button--primary"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quero conversar sobre terapia
                  <ArrowUpRight aria-hidden="true" />
                </a>
                <a className="text-link" href="#psicoterapia">
                  Conheça meu trabalho
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>

              <p className="contact-care">
                Para proteger sua privacidade, evite enviar informações
                sensíveis no primeiro contato.
              </p>

              <p className="professional-line">
                <span aria-hidden="true" />
                Breytilla Katyeliny Silva Souza · Psicóloga · CRP 06/180155
              </p>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-image-frame">
                <Image
                  src="/hero-editorial.webp"
                  alt=""
                  width={1200}
                  height={1500}
                  preload
                  sizes="(max-width: 900px) 88vw, 42vw"
                />
              </div>
              <div className="hero-seal">
                <span>Presença</span>
                <i />
                <span>Escuta</span>
              </div>
              <p className="hero-note">Acolhimento · consciência · encontro</p>
            </div>
          </div>
        </section>

        <section className="recognition section" aria-labelledby="recognition-title">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div>
                <p className="eyebrow">Talvez este seja o seu momento</p>
                <h2 id="recognition-title">
                  Há fases em que precisamos de um lugar para <em>nos escutar.</em>
                </h2>
              </div>
              <p>
                Nem sempre é fácil nomear o que acontece por dentro. A terapia
                pode oferecer um espaço de escuta para olhar com mais presença
                para aquilo que tem pedido atenção.
              </p>
            </div>

            <div className="recognition-grid">
              {recognitionItems.map((item, index) => (
                <article className="recognition-card" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="therapy section section--dark"
          id="psicoterapia"
          aria-labelledby="therapy-title"
        >
          <div className="therapy-orbit" aria-hidden="true" />
          <div className="container therapy-grid">
            <div className="therapy-copy">
              <p className="eyebrow eyebrow--light">Psicoterapia e Gestalt-terapia</p>
              <h2 id="therapy-title">
                Um encontro com o que existe <em>aqui e agora.</em>
              </h2>
              <div className="therapy-text">
                <p>
                  A Gestalt-terapia compreende cada pessoa em sua totalidade:
                  corpo, emoções, pensamentos, relações e contexto. Em vez de
                  oferecer respostas prontas, o processo convida você a ampliar
                  a percepção sobre como vive, sente e se relaciona.
                </p>
                <p>
                  A partir de uma escuta cuidadosa e de um diálogo construído
                  juntas, olhamos para sua experiência presente sem apagar sua
                  história — respeitando sua singularidade e o seu tempo.
                </p>
              </div>
            </div>

            <aside className="focus-card" aria-label="Áreas de acompanhamento">
              <p className="focus-label">Questões que podemos acolher</p>
              <ul>
                {focusAreas.map((area) => (
                  <li key={area}>
                    <Diamond aria-hidden="true" />
                    {area}
                  </li>
                ))}
              </ul>
              <p className="focus-note">
                Cada história é única. Esses temas são pontos de partida, não
                rótulos para definir a sua experiência.
              </p>
            </aside>
          </div>
        </section>

        <section className="process section" aria-labelledby="process-title">
          <div className="container">
            <div className="section-heading section-heading--centered">
              <p className="eyebrow">Como funciona</p>
              <h2 id="process-title">
                Começar pode ser mais <em>simples e cuidadoso.</em>
              </h2>
              <p>
                O primeiro passo é apenas uma conversa para você conhecer o
                funcionamento do atendimento e perceber se deseja seguir.
              </p>
            </div>

            <ol className="process-grid">
              {processSteps.map((step) => (
                <li className="process-step" key={step.number}>
                  <div className="step-number">{step.number}</div>
                  <div className="step-line" aria-hidden="true" />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className="process-cta">
              <a
                className="button button--primary"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Verificar disponibilidade
                <ArrowUpRight aria-hidden="true" />
              </a>
              <p>
                Atendimento individual · online · mulheres adultas (18+) no
                Brasil
              </p>
            </div>
          </div>
        </section>

        <section
          className="about section"
          id="sobre"
          aria-labelledby="about-title"
        >
          <div className="container about-grid">
            <div className="about-signature" aria-hidden="true">
              <div className="about-monogram">B</div>
              <p>
                “A escuta começa quando podemos chegar por inteiro, sem precisar
                ter todas as respostas.”
              </p>
            </div>

            <div className="about-copy">
              <p className="eyebrow">Sobre mim</p>
              <h2 id="about-title">
                Sou Breytilla. Psicóloga, presença e <em>escuta.</em>
              </h2>
              <p className="about-lead">
                Meu nome é Breytilla Katyeliny Silva Souza. Sou psicóloga,
                formada há quatro anos, e conduzo meu trabalho a partir da
                Gestalt-terapia.
              </p>
              <p>
                Minha escuta parte do encontro com aquilo que você sente,
                percebe e vive no presente, sem reduzir sua história a rótulos.
                Acredito em um cuidado que respeita a singularidade e abre
                espaço para compreender escolhas, necessidades e formas de se
                relacionar.
              </p>

              <dl className="credentials">
                <div>
                  <dt>Profissional</dt>
                  <dd>Breytilla Katyeliny Silva Souza</dd>
                </div>
                <div>
                  <dt>Registro</dt>
                  <dd>CRP 06/180155</dd>
                </div>
                <div>
                  <dt>Abordagem</dt>
                  <dd>Gestalt-terapia</dd>
                </div>
                <div>
                  <dt>Modalidade</dt>
                  <dd>Psicoterapia individual online</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section
          className="faq section"
          id="duvidas"
          aria-labelledby="faq-title"
        >
          <div className="container faq-grid">
            <div className="faq-intro">
              <p className="eyebrow">Dúvidas frequentes</p>
              <h2 id="faq-title">
                Antes de começar, você pode querer <em>saber um pouco mais.</em>
              </h2>
              <p>
                Se sua pergunta não estiver aqui, você pode me escrever. O
                primeiro contato é também um espaço para esclarecer o que
                precisar.
              </p>
              <a
                className="text-link text-link--strong"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar uma pergunta
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>

            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    <span>{faq.question}</span>
                    <i aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closing" id="contato" aria-labelledby="closing-title">
          <div className="closing-orbit closing-orbit--one" aria-hidden="true" />
          <div className="closing-orbit closing-orbit--two" aria-hidden="true" />
          <div className="container closing-inner">
            <p className="eyebrow eyebrow--light">Seu primeiro passo</p>
            <h2 id="closing-title">
              Talvez voltar para si comece com a decisão de <em>não atravessar tudo sozinha.</em>
            </h2>
            <p>
              Se desejar conhecer melhor o atendimento, escreva para mim. Sem
              pressa e sem compromisso de começar antes de se sentir pronta.
            </p>
            <a
              className="button button--light"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conversar pelo WhatsApp
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <a className="wordmark wordmark--footer" href="#inicio">
              Brey<em>tilla</em>
            </a>
            <p>Psicoterapia online para mulheres adultas</p>
          </div>

          <div className="footer-professional">
            <strong>Breytilla Katyeliny Silva Souza</strong>
            <span>Psicóloga · CRP 06/180155</span>
          </div>

          <div className="footer-links" aria-label="Canais de contato">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp · (16) 99212-6214 <ArrowUpRight aria-hidden="true" />
            </a>
            <a href="mailto:psibreytillak@gmail.com">
              E-mail · psibreytillak@gmail.com <ArrowUpRight aria-hidden="true" />
            </a>
            <a
              href="https://instagram.com/breytillak"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram · @breytillak <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="container emergency-note">
          <p>
            Este site e o WhatsApp profissional não oferecem atendimento de
            urgência ou emergência. Em situação de risco imediato, procure uma
            UPA ou pronto-socorro ou ligue para o{" "}
            <a
              href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192/samu-192"
              target="_blank"
              rel="noopener noreferrer"
            >
              SAMU 192
            </a>
            . Para apoio emocional, ligue gratuitamente para o{" "}
            <a
              href="https://cvv.org.br/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CVV 188
            </a>
            .
          </p>
        </div>

        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Breytilla</span>
          <span>Psicologia com presença, ética e cuidado.</span>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
