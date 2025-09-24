/**
 * Словарь синонимов российских единиц измерения, веществ и материалов
 * Извлечено из comprehensive_russian_extractor.py для задач 5.3.1-5.3.2
 */

// Интерфейсы для типизации
export interface SynonymGroup {
  canonical: string;
  synonyms: string[];
  category: string;
  type: 'substance' | 'unit';
}

export interface SynonymDictionary {
  [category: string]: {
    substances: SynonymGroup[];
    units: SynonymGroup[];
  };
}

/**
 * Основной словарь синонимов российских единиц и веществ
 * Структурированный по категориям ESG-отчетности
 */
export const RUSSIAN_SYNONYM_DICTIONARY: SynonymDictionary = {
  // Жидкое топливо
  fuel_liquid: {
    substances: [
      {
        canonical: "дизельное топливо",
        synonyms: [
          // Стандартные варианты
          "дизель", "ДТ", "солярка", "дизтопливо", "дизельное топливо",
          // Сокращения и опечатки согласно плану v1.3
          "диз топливо", "дизел", "дызель", "д/т", "диз", "дизель топливо",
          "диз.топливо", "д.т.", "дизтоп", "дизельн.топливо", "диз-топливо",
          // Украинские варианты
          "дизельне паливо", "дизель", "ДП", "дизельн паливо",
          // OCR ошибки и замены
          "дизеля", "дизeль", "дuзель", "дизель.", "дизеnь",
          "диэель", "дизнль", "дазель", "днзель", "лизель",
          // Разговорные и жаргонные
          "солярочка", "дизуха", "дизельник", "лт", "д-т"
        ],
        category: "fuel_liquid",
        type: "substance"
      },
      {
        canonical: "бензин",
        synonyms: ["АИ-92", "АИ-95", "АИ-98", "АИ-80", "бензин АИ-100", "бензин неэтилированный", "автобензин"],
        category: "fuel_liquid", 
        type: "substance"
      },
      {
        canonical: "керосин",
        synonyms: ["авиакеросин", "ТС-1", "РТ", "керосин осветительный", "реактивное топливо"],
        category: "fuel_liquid",
        type: "substance"
      },
      {
        canonical: "мазут",
        synonyms: ["мазут топочный", "мазут М-40", "мазут М-100", "мазут М-200"],
        category: "fuel_liquid",
        type: "substance"
      },
      {
        canonical: "биодизель",
        synonyms: ["этанол", "метанол", "МТБЭ", "биотопливо"],
        category: "fuel_liquid",
        type: "substance"
      },
      {
        canonical: "условное топливо",
        synonyms: ["топливо условное", "у.т."],
        category: "fuel_liquid",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "л",
        synonyms: ["литр", "литров", "литра", "дм³", "дм3"],
        category: "fuel_liquid",
        type: "unit"
      },
      {
        canonical: "м³",
        synonyms: ["м3", "куб.м", "кубометр", "кубических метров", "кубометров"],
        category: "fuel_liquid", 
        type: "unit"
      },
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "fuel_liquid",
        type: "unit"
      },
      {
        canonical: "кг",
        synonyms: ["килограмм", "килограммов", "кг"],
        category: "fuel_liquid",
        type: "unit"
      },
      {
        canonical: "т у.т.",
        synonyms: ["тонн у.т.", "тонны у.т.", "тонна у.т.", "кг у.т.", "килограмм у.т."],
        category: "fuel_liquid",
        type: "unit"
      }
    ]
  },

  // Газообразное топливо
  fuel_gaseous: {
    substances: [
      {
        canonical: "природный газ",
        synonyms: [
          // Стандартные варианты
          "газ", "метан", "ПГ", "газ природный",
          // Химические обозначения согласно плану v1.3
          "CH4", "СН4", "Ch4", "ch4", "CH₄", "C2H6", "пропан",
          // Сокращения и аббревиатуры
          "газприр.", "мет.газ", "прир.газ", "п.г.", "газ прир.",
          "природ.газ", "прир газ", "газ.прир", "газ-метан",
          // Украинские варианты
          "природний газ", "газ природний", "метан", "ПГ",
          // OCR ошибки
          "газ", "rаз", "гаэ", "гах", "гаs", "газ.", "г4з",
          "мeтан", "метаи", "мeган", "нетан", "метам",
          // Технические варианты
          "газообразное топливо", "газовое топливо", "углеводородный газ",
          "компримированный газ", "сжатый газ", "КПГ", "СПГ"
        ],
        category: "fuel_gaseous",
        type: "substance"
      },
      {
        canonical: "сжиженный газ",
        synonyms: ["пропан", "бутан", "пропан-бутан", "СУГ", "сжиженный углеводородный газ"],
        category: "fuel_gaseous", 
        type: "substance"
      },
      {
        canonical: "попутный нефтяной газ",
        synonyms: ["ПНГ", "газ попутный"],
        category: "fuel_gaseous",
        type: "substance"
      },
      {
        canonical: "биогаз",
        synonyms: ["синтез-газ", "коксовый газ", "доменный газ"],
        category: "fuel_gaseous",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "м³",
        synonyms: ["м3", "куб.м", "кубометр", "кубических метров", "кубометров"],
        category: "fuel_gaseous",
        type: "unit"
      },
      {
        canonical: "нм³", 
        synonyms: ["нм3", "нормальный кубометр", "норм.куб.м"],
        category: "fuel_gaseous",
        type: "unit"
      },
      {
        canonical: "тыс.м³",
        synonyms: ["тысяч кубометров", "тыс.нм³"],
        category: "fuel_gaseous",
        type: "unit"
      },
      {
        canonical: "млн.м³",
        synonyms: ["млн.нм³", "миллионов кубометров"],
        category: "fuel_gaseous",
        type: "unit"
      }
    ]
  },

  // Твердое топливо
  fuel_solid: {
    substances: [
      {
        canonical: "уголь",
        synonyms: ["каменный уголь", "бурый уголь", "уголь энергетический"],
        category: "fuel_solid",
        type: "substance"
      },
      {
        canonical: "кокс",
        synonyms: ["антрацит", "полукокс", "угольная пыль"],
        category: "fuel_solid",
        type: "substance"
      },
      {
        canonical: "торф",
        synonyms: ["торфяные брикеты"],
        category: "fuel_solid",
        type: "substance"
      },
      {
        canonical: "пеллеты",
        synonyms: ["древесные гранулы", "древесные пеллеты"],
        category: "fuel_solid", 
        type: "substance"
      },
      {
        canonical: "древесина",
        synonyms: ["дрова", "опилки", "щепа", "биомасса", "отходы древесины"],
        category: "fuel_solid",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "fuel_solid", 
        type: "unit"
      },
      {
        canonical: "кг",
        synonyms: ["килограмм", "килограммов"],
        category: "fuel_solid",
        type: "unit"
      },
      {
        canonical: "ц",
        synonyms: ["центнер", "центнеров"],
        category: "fuel_solid",
        type: "unit"
      }
    ]
  },

  // Электроэнергия
  electricity: {
    substances: [
      {
        canonical: "электроэнергия",
        synonyms: [
          // Стандартные варианты
          "электричество", "эл.энергия", "электроэнергия активная", "потребление электроэнергии",
          // Сокращения согласно плану v1.3
          "электр", "элект", "ел-во", "э/э", "элек-во", "электр.", "эл-во", "электр-во",
          "э-энергия", "элек", "електр", "электро", "эл энергия", "эл-энергия",
          // Украинские варианты (частые в документах)
          "електроенергія", "електрика", "електр", "електричество",
          // OCR ошибки (латинские/кириллические замены)  
          "электpoэнергия", "eлектроэнергия", "элeктpoэнергия", "электpичество",
          "електроэнергия", "эдектроэнергия", "злектроэнергия",
          // Типичные опечатки и сокращения из документов
          "эл-ва", "э-во", "э.э.", "эл.эн.", "эн.эл.", "илек.", "элекр.",
          "электро-энергия", "электро энергия", "элекромэнергия"
        ],
        category: "electricity",
        type: "substance"
      },
      {
        canonical: "активная электроэнергия", 
        synonyms: ["активная энергия", "электроэнергия активная импорт"],
        category: "electricity",
        type: "substance"
      },
      {
        canonical: "реактивная электроэнергия",
        synonyms: ["реактивная энергия"],
        category: "electricity",
        type: "substance"
      },
      {
        canonical: "электрическая мощность",
        synonyms: ["мощность электрическая", "нагрузка электрическая"],
        category: "electricity", 
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "кВт·ч",
        synonyms: ["кВтч", "кВт*ч", "кВт-ч", "киловатт-час", "киловатт-часов"],
        category: "electricity",
        type: "unit"
      },
      {
        canonical: "МВт·ч",
        synonyms: ["МВтч", "МВт*ч", "МВт-ч", "мегаватт-час", "мегаватт-часов"],
        category: "electricity",
        type: "unit"
      },
      {
        canonical: "ГВт·ч",
        synonyms: ["ГВтч", "ГВт*ч", "ГВт-ч", "гигаватт-час", "гигаватт-часов"],
        category: "electricity",
        type: "unit"
      },
      {
        canonical: "квар·ч",
        synonyms: ["кварч", "квар*ч", "киловар-час", "киловар-часов"],
        category: "electricity",
        type: "unit"
      },
      {
        canonical: "кВт",
        synonyms: ["киловатт", "киловаттов"],
        category: "electricity",
        type: "unit"
      },
      {
        canonical: "МВт",
        synonyms: ["мегаватт", "мегаваттов"],
        category: "electricity",
        type: "unit"
      }
    ]
  },

  // Тепловая энергия
  heat_energy: {
    substances: [
      {
        canonical: "тепловая энергия",
        synonyms: [
          // Стандартные варианты
          "теплоэнергия", "отопление", "теплота", "энергия тепловая",
          // Сокращения согласно плану v1.3
          "тепло", "тепл.энергия", "тепл.эн.", "тепл-энергия", "теп.энергия",
          "тепло энергия", "тепло-энергия", "т.энергия", "т.э.",
          // Технические варианты
          "тепловая мощность", "теплопотребление", "теплоснабжение",
          "централизованное отопление", "ЦО", "отопл.",
          // Сокращения и аббревиатуры
          "ГКал", "гигакалория", "тепл.", "отопл", "теплосн.",
          "теплопр.", "тепло-снабжение", "центр.отопление",
          // Украинские варианты
          "теплова енергія", "опалення", "теплопостачання",
          // OCR ошибки
          "тeпло", "teпло", "тепло.", "тепnо", "тeплo",
          "теплоэнepгия", "теплоэнергuя", "теплоэиергия",
          // Разговорные
          "тепло", "обогрев", "отопительная система", "батареи"
        ],
        category: "heat_energy",
        type: "substance"
      },
      {
        canonical: "горячая вода",
        synonyms: ["ГВС", "горячее водоснабжение"],
        category: "heat_energy",
        type: "substance"
      },
      {
        canonical: "теплоснабжение",
        synonyms: ["централизованное теплоснабжение", "отопление централизованное"],
        category: "heat_energy",
        type: "substance"
      },
      {
        canonical: "пар",
        synonyms: ["пар технологический", "пар отопительный", "пар насыщенный"],
        category: "heat_energy",
        type: "substance"
      },
      {
        canonical: "теплоноситель",
        synonyms: ["конденсат"],
        category: "heat_energy",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "Гкал",
        synonyms: [
          // Стандартные варианты
          "гигакалория", "гигакалорий", "ГКАЛ", "Гкал/ч",
          // Различные написания согласно плану v1.3
          "ГКал", "Г.кал", "Г-кал", "г.кал", "гкал", "гигаКал",
          "гигакалории", "Гкалории", "Г калория", "Г-калория",
          "гкал.", "ГКал.", "ГКАЛ.", "Гкал:", "ГКал:",
          // Временные единицы
          "Гкал/час", "Гкал/ч", "Гкал/h", "ГКал/час", "ГКал/ч",
          "Гкал в час", "Гкал за час", "гкал/час", "гкал/ч",
          // OCR ошибки
          "Гкaл", "Гка1", "Г1сал", "Гкаl", "ГkaЛ", "Гkал",
          "гигакаnория", "гигакалорuя", "гuгакалория",
          // Украинские варианты
          "Гкал", "гігакалорія", "гігакалорій", "Г-кал"
        ],
        category: "heat_energy",
        type: "unit"
      },
      {
        canonical: "ккал",
        synonyms: ["килокалория", "килокалорий"],
        category: "heat_energy",
        type: "unit"
      },
      {
        canonical: "Мкал",
        synonyms: ["мегакалория", "мегакалорий"],
        category: "heat_energy",
        type: "unit"
      },
      {
        canonical: "ГДж",
        synonyms: ["гигаджоуль", "гигаджоулей"],
        category: "heat_energy", 
        type: "unit"
      },
      {
        canonical: "МДж",
        synonyms: ["мегаджоуль", "мегаджоулей"],
        category: "heat_energy",
        type: "unit"
      },
      {
        canonical: "кДж",
        synonyms: ["килоджоуль", "килоджоулей"],
        category: "heat_energy",
        type: "unit"
      }
    ]
  },

  // Транспорт
  transport: {
    substances: [
      {
        canonical: "пробег",
        synonyms: ["километраж", "пройденное расстояние", "пройдено км", "общий пробег"],
        category: "transport",
        type: "substance"
      },
      {
        canonical: "транспортная работа",
        synonyms: [
          // Стандартные варианты
          "перевозка", "доставка", "транспортировка", "грузооборот",
          // Сокращения согласно плану v1.3
          "транспорт", "авто", "грузовик", "логистика", "пробег",
          "автотранспорт", "автомобильный транспорт", "а/т", "авт.транспорт",
          "транс.", "трансп.", "логист.", "перевозки", "доставки",
          // Типы транспорта
          "грузовой автомобиль", "легковой автомобиль", "автобус",
          "спецтехника", "автопарк", "машины", "техника",
          // Украинские варианты
          "транспорт", "перевезення", "доставка", "логістика",
          "автотранспорт", "автомобільний транспорт",
          // OCR ошибки
          "транcпорт", "трансnорт", "транспoрт", "тpaнспорт",
          "лorистика", "логистuка", "логuстика", "логистикa",
          "автo", "aвто", "авт0", "автомобuль", "грузовuк",
          // Разговорные
          "машины", "автопарк", "флот", "техника", "автомобили"
        ],
        category: "transport",
        type: "substance"
      },
      {
        canonical: "грузоперевозки",
        synonyms: ["перевозка грузов"],
        category: "transport",
        type: "substance"
      },
      {
        canonical: "пассажироперевозки",
        synonyms: ["перевозка пассажиров", "пассажирооборот"],
        category: "transport",
        type: "substance"
      },
      {
        canonical: "машино-часы",
        synonyms: ["моточасы", "часы работы", "наработка", "время работы двигателя"],
        category: "transport",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "км",
        synonyms: [
          // Стандартные варианты
          "километр", "километров", "километра",
          // Сокращения согласно плану v1.3
          "км", "КМ", "км.", "km", "Км", "к.м", "к-м",
          "килом.", "киломе.", "километ.", "километр.",
          // Различные написания
          "километры", "километрах", "километрами", "километ",
          "км/ч", "км в час", "км за час", "км/час",
          // Украинские варианты
          "км", "кілометр", "кілометрів", "кілометра",
          "кілометри", "км.", "киломе.",
          // OCR ошибки
          "kм", "км", "кm", "кн", "ки", "кл", "км.",
          "километp", "километp", "километ", "киломeтр",
          "километров", "киломeтров", "киломегров"
        ],
        category: "transport",
        type: "unit"
      },
      {
        canonical: "м",
        synonyms: ["метр", "метров"],
        category: "transport",
        type: "unit"
      },
      {
        canonical: "ткм",
        synonyms: ["т-км", "т⋅км", "тонно-километр", "тонно-километров"],
        category: "transport",
        type: "unit"
      },
      {
        canonical: "пкм", 
        synonyms: ["п-км", "п⋅км", "пассажиро-километр", "пассажиро-километров"],
        category: "transport",
        type: "unit"
      },
      {
        canonical: "ч",
        synonyms: ["час", "часов", "часа"],
        category: "transport",
        type: "unit"
      },
      {
        canonical: "мч",
        synonyms: ["моточас", "моточасов", "моточаса", "маш-ч", "машино-час", "машино-часов"],
        category: "transport",
        type: "unit"
      }
    ]
  },

  // Вода
  water: {
    substances: [
      {
        canonical: "холодная вода",
        synonyms: [
          // Стандартные варианты
          "ХВС", "холодное водоснабжение", "вода питьевая",
          // Общие варианты согласно плану v1.3
          "вода", "водоснабжение", "водопотр.", "водопотребление",
          "вода хол.", "хол.вода", "вода питьевая", "вода холод.",
          // Сокращения
          "х.в.с.", "хвс", "ХВС", "х.в.", "хол.в.", "водоп.",
          "водосн.", "водоснаб.", "в.х.", "в.хол.",
          // Украинские варианты
          "холодна вода", "водопостачання", "вода питна", "ХВП",
          // OCR ошибки
          "вола", "воnа", "вода.", "волa", "водa", "вoда",
          "хвc", "XBC", "хвс.", "X.B.C.", "хвс:",
          // Разговорные
          "холодняк", "водичка", "водопровод", "водопроводная"
        ],
        category: "water",
        type: "substance"
      },
      {
        canonical: "горячая вода",
        synonyms: [
          // Стандартные варианты
          "ГВС", "горячее водоснабжение", "вода горячая",
          // Общие варианты
          "гор.вода", "вода гор.", "вода горячая", "горяч.вода",
          // Сокращения
          "г.в.с.", "гвс", "ГВС", "г.в.", "гор.в.",
          "г.водоснаб.", "гор.водосн.", "в.г.", "в.гор.",
          // Украинские варианты
          "гаряча вода", "гаряче водопостачання", "ГВП",
          // OCR ошибки
          "гвc", "GBC", "ГВC", "гвс.", "г.в.с.",
          "горячaя", "гopячая", "горячаа", "горяяая",
          // Разговорные
          "горячка", "кипяток", "горячий водопровод"
        ],
        category: "water", 
        type: "substance"
      },
      {
        canonical: "техническая вода",
        synonyms: ["производственная вода", "оборотная вода"],
        category: "water",
        type: "substance"
      },
      {
        canonical: "сточные воды",
        synonyms: ["водоотведение", "канализация", "стоки", "промышленные стоки"],
        category: "water",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "м³",
        synonyms: ["м3", "куб.м", "кубометр", "кубических метров", "кубометров"],
        category: "water",
        type: "unit"
      },
      {
        canonical: "л",
        synonyms: ["литр", "литров", "литра", "дм³", "дм3"],
        category: "water",
        type: "unit"
      },
      {
        canonical: "тыс.м³",
        synonyms: ["тысяч кубометров"],
        category: "water",
        type: "unit"
      },
      {
        canonical: "млн.м³",
        synonyms: ["миллионов кубометров"],
        category: "water",
        type: "unit"
      }
    ]
  },

  // Металлы
  materials_metals: {
    substances: [
      {
        canonical: "сталь",
        synonyms: ["углеродистая сталь", "легированная сталь", "нержавеющая сталь"],
        category: "materials_metals",
        type: "substance"
      },
      {
        canonical: "чугун",
        synonyms: ["железо"],
        category: "materials_metals",
        type: "substance"
      },
      {
        canonical: "металлопрокат",
        synonyms: ["металлоизделия"],
        category: "materials_metals",
        type: "substance"
      },
      {
        canonical: "цветные металлы",
        synonyms: ["алюминий", "медь", "цинк", "свинец", "олово", "никель", "титан", "магний"],
        category: "materials_metals",
        type: "substance"
      },
      {
        canonical: "металлолом",
        synonyms: ["лом черных металлов", "лом цветных металлов"],
        category: "materials_metals",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "materials_metals",
        type: "unit"
      },
      {
        canonical: "кг", 
        synonyms: ["килограмм", "килограммов"],
        category: "materials_metals",
        type: "unit"
      },
      {
        canonical: "ц",
        synonyms: ["центнер", "центнеров"],
        category: "materials_metals",
        type: "unit"
      },
      {
        canonical: "г",
        synonyms: ["грамм", "граммов"],
        category: "materials_metals", 
        type: "unit"
      }
    ]
  },

  // Строительные материалы
  materials_construction: {
    substances: [
      {
        canonical: "цемент",
        synonyms: ["портландцемент"],
        category: "materials_construction",
        type: "substance"
      },
      {
        canonical: "бетон",
        synonyms: ["железобетон", "раствор"],
        category: "materials_construction",
        type: "substance"
      },
      {
        canonical: "кирпич",
        synonyms: ["керамический кирпич", "силикатный кирпич", "облицовочный кирпич"],
        category: "materials_construction",
        type: "substance"
      },
      {
        canonical: "инертные материалы",
        synonyms: ["песок", "щебень", "гравий"],
        category: "materials_construction",
        type: "substance"
      },
      {
        canonical: "вяжущие",
        synonyms: ["известь", "гипс"],
        category: "materials_construction",
        type: "substance"
      },
      {
        canonical: "стекло",
        synonyms: ["оконное стекло", "листовое стекло", "стеклопакеты"],
        category: "materials_construction",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "materials_construction",
        type: "unit"
      },
      {
        canonical: "кг",
        synonyms: ["килограмм", "килограммов"],
        category: "materials_construction",
        type: "unit"
      },
      {
        canonical: "м³",
        synonyms: ["м3", "кубометр", "кубических метров", "кубометров"],
        category: "materials_construction",
        type: "unit"
      },
      {
        canonical: "м²",
        synonyms: ["м2", "квадратный метр", "квадратных метров", "кв.м"],
        category: "materials_construction", 
        type: "unit"
      },
      {
        canonical: "шт",
        synonyms: ["штук", "штуки", "штука", "ед", "единиц", "единица"],
        category: "materials_construction",
        type: "unit"
      }
    ]
  },

  // Химические вещества и пластики
  chemicals_plastics: {
    substances: [
      {
        canonical: "пластик",
        synonyms: ["полиэтилен", "полипропилен", "ПВХ", "поливинилхлорид"],
        category: "chemicals_plastics",
        type: "substance"
      },
      {
        canonical: "полимеры",
        synonyms: ["полистирол", "полиамид", "полиуретан", "эпоксидные смолы"],
        category: "chemicals_plastics",
        type: "substance"
      },
      {
        canonical: "химические реактивы",
        synonyms: ["растворители", "кислоты", "щелочи"],
        category: "chemicals_plastics",
        type: "substance"
      },
      {
        canonical: "лакокрасочные материалы",
        synonyms: ["краски", "лаки", "эмали", "грунтовки"],
        category: "chemicals_plastics",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "chemicals_plastics",
        type: "unit"
      },
      {
        canonical: "кг",
        synonyms: ["килограмм", "килограммов"],
        category: "chemicals_plastics",
        type: "unit"
      },
      {
        canonical: "л",
        synonyms: ["литр", "литров", "литра"],
        category: "chemicals_plastics",
        type: "unit"
      },
      {
        canonical: "м³",
        synonyms: ["м3", "кубометров"],
        category: "chemicals_plastics",
        type: "unit"
      }
    ]
  },

  // Отходы
  waste: {
    substances: [
      {
        canonical: "твердые коммунальные отходы",
        synonyms: ["отходы", "ТКО"],
        category: "waste",
        type: "substance"
      },
      {
        canonical: "промышленные отходы",
        synonyms: ["производственные отходы"],
        category: "waste",
        type: "substance"
      },
      {
        canonical: "строительные отходы",
        synonyms: ["строительный мусор"],
        category: "waste",
        type: "substance"
      },
      {
        canonical: "вторичные ресурсы",
        synonyms: ["металлолом", "макулатура", "стеклобой", "пластиковые отходы"],
        category: "waste",
        type: "substance"
      },
      {
        canonical: "органические отходы",
        synonyms: ["биоотходы", "пищевые отходы"],
        category: "waste",
        type: "substance"
      },
      {
        canonical: "опасные отходы",
        synonyms: ["медицинские отходы", "электронные отходы"],
        category: "waste",
        type: "substance"
      }
    ],
    units: [
      {
        canonical: "т",
        synonyms: ["тонн", "тонны", "тонна"],
        category: "waste",
        type: "unit"
      },
      {
        canonical: "кг",
        synonyms: ["килограмм", "килограммов"],
        category: "waste",
        type: "unit"
      },
      {
        canonical: "м³",
        synonyms: ["м3", "кубометр", "кубических метров", "кубометров"],
        category: "waste",
        type: "unit"
      }
    ]
  }
};

/**
 * Функция для поиска канонического названия по синониму
 * @param input - входная строка (может быть синонимом)
 * @param category - категория для поиска (опционально)
 * @returns канонический термин или исходную строку если не найдено
 */
export function findCanonical(input: string, category?: string): string {
  const normalizedInput = input.toLowerCase().trim();
  
  // Определяем в каких категориях искать
  const categoriesToSearch = category 
    ? [category] 
    : Object.keys(RUSSIAN_SYNONYM_DICTIONARY);

  for (const cat of categoriesToSearch) {
    const categoryData = RUSSIAN_SYNONYM_DICTIONARY[cat];
    if (!categoryData) continue;

    // Ищем среди веществ
    for (const substanceGroup of categoryData.substances) {
      if (substanceGroup.canonical.toLowerCase() === normalizedInput) {
        return substanceGroup.canonical;
      }
      
      for (const synonym of substanceGroup.synonyms) {
        if (synonym.toLowerCase() === normalizedInput) {
          return substanceGroup.canonical;
        }
      }
    }

    // Ищем среди единиц
    for (const unitGroup of categoryData.units) {
      if (unitGroup.canonical.toLowerCase() === normalizedInput) {
        return unitGroup.canonical;
      }
      
      for (const synonym of unitGroup.synonyms) {
        if (synonym.toLowerCase() === normalizedInput) {
          return unitGroup.canonical;
        }
      }
    }
  }

  // Если не найдено, возвращаем исходную строку
  return input;
}

/**
 * Функция для получения всех синонимов канонического термина
 * @param canonical - каноническое название
 * @param category - категория для поиска (опционально)
 * @returns массив синонимов или пустой массив если не найдено
 */
export function getSynonyms(canonical: string, category?: string): string[] {
  const normalizedCanonical = canonical.toLowerCase().trim();
  
  const categoriesToSearch = category 
    ? [category] 
    : Object.keys(RUSSIAN_SYNONYM_DICTIONARY);

  for (const cat of categoriesToSearch) {
    const categoryData = RUSSIAN_SYNONYM_DICTIONARY[cat];
    if (!categoryData) continue;

    // Ищем среди веществ
    for (const substanceGroup of categoryData.substances) {
      if (substanceGroup.canonical.toLowerCase() === normalizedCanonical) {
        return [...substanceGroup.synonyms];
      }
    }

    // Ищем среди единиц
    for (const unitGroup of categoryData.units) {
      if (unitGroup.canonical.toLowerCase() === normalizedCanonical) {
        return [...unitGroup.synonyms];
      }
    }
  }

  return [];
}

/**
 * Функция для определения категории термина
 * @param input - входная строка
 * @returns название категории или null если не найдено
 */
export function getCategory(input: string): string | null {
  const normalizedInput = input.toLowerCase().trim();
  
  for (const [category, categoryData] of Object.entries(RUSSIAN_SYNONYM_DICTIONARY)) {
    // Проверяем вещества
    for (const substanceGroup of categoryData.substances) {
      if (substanceGroup.canonical.toLowerCase() === normalizedInput ||
          substanceGroup.synonyms.some(syn => syn.toLowerCase() === normalizedInput)) {
        return category;
      }
    }

    // Проверяем единицы
    for (const unitGroup of categoryData.units) {
      if (unitGroup.canonical.toLowerCase() === normalizedInput ||
          unitGroup.synonyms.some(syn => syn.toLowerCase() === normalizedInput)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Функция для получения типа термина (substance или unit)
 * @param input - входная строка
 * @returns тип термина или null если не найдено
 */
export function getType(input: string): 'substance' | 'unit' | null {
  const normalizedInput = input.toLowerCase().trim();
  
  for (const categoryData of Object.values(RUSSIAN_SYNONYM_DICTIONARY)) {
    // Проверяем вещества
    for (const substanceGroup of categoryData.substances) {
      if (substanceGroup.canonical.toLowerCase() === normalizedInput ||
          substanceGroup.synonyms.some(syn => syn.toLowerCase() === normalizedInput)) {
        return 'substance';
      }
    }

    // Проверяем единицы
    for (const unitGroup of categoryData.units) {
      if (unitGroup.canonical.toLowerCase() === normalizedInput ||
          unitGroup.synonyms.some(syn => syn.toLowerCase() === normalizedInput)) {
        return 'unit';
      }
    }
  }

  return null;
}

/**
 * Функция для получения статистики словаря
 * @returns объект со статистикой
 */
export function getDictionaryStats() {
  const stats = {
    totalCategories: 0,
    totalSubstances: 0,
    totalUnits: 0,
    totalSynonyms: 0,
    categoryBreakdown: {} as Record<string, { substances: number; units: number; synonyms: number }>
  };

  for (const [category, categoryData] of Object.entries(RUSSIAN_SYNONYM_DICTIONARY)) {
    stats.totalCategories++;
    
    const categoryStats = {
      substances: categoryData.substances.length,
      units: categoryData.units.length,
      synonyms: 0
    };

    // Подсчитываем синонимы
    for (const group of categoryData.substances) {
      categoryStats.synonyms += group.synonyms.length;
    }
    for (const group of categoryData.units) {
      categoryStats.synonyms += group.synonyms.length;
    }

    stats.totalSubstances += categoryStats.substances;
    stats.totalUnits += categoryStats.units;
    stats.totalSynonyms += categoryStats.synonyms;
    
    stats.categoryBreakdown[category] = categoryStats;
  }

  return stats;
}

// Экспортируем список всех категорий для удобства
export const AVAILABLE_CATEGORIES = Object.keys(RUSSIAN_SYNONYM_DICTIONARY);

// Экспортируем основные типы
export type CategoryName = keyof typeof RUSSIAN_SYNONYM_DICTIONARY;
export type TermType = 'substance' | 'unit';