class Effect {
    constructor() {
        this.year = 0;
        this.doDisplay = false;
    }

    getDateRanges() {
        return this.dateRanges || [];
    }

    getYear() {
        return this.year || 0;
    }

    getMonth() {
        return this.month || 0;
    }

    getDay() {
        return this.day || 0;
    }

    getSize() {
        return this.size || 1;
    }

    getParticleCount() {
        return this.particleCount || -1;
    }

    getSpeedMax() {
        return this.speedMax || 100;
    }

    getSpeedMin() {
        return this.speedMin || 50;
    }

    getWeatherCode() {
        return this.weatherCode || -99;
    }

    getMinWeatherCode() {
        return this.weatherCodeMin || 99999;
    }

    getMaxWeatherCode() {
        return this.weatherCodeMax || -99999;
    }

    hasWeatherCode() {
        return (this.weatherCode > 0) || (this.weatherCodeMin > 0) || (this.weatherCodeMax > 0);
    }

    hasHoliday() {
        return this.holiday && this.holiday.length > 0;
    }

    clone(other) {
        Object.assign(this, other);
    }
}

function createImageElement(src, size) {
    const img = document.createElement("div");
    img.style.backgroundImage = `url('./modules/MMM-DynamicWeather/images/${src}')`;
    img.style.transform = `scale(${size}, ${size})`;
    img.style.opacity = size;
    return img;
}

function createFlake(effect, size) {
    const flake = document.createElement("div");
    const jiggle = document.createElement("div");
    const flakeImage = createImageElement(effect.images[Math.floor(Math.random() * effect.images.length)], size);

    jiggle.style.animationDelay = `${Math.random() * effect.getSpeedMax()}s`;
    jiggle.style.animationDuration = `${effect.getSpeedMax() - Math.random() * effect.getSpeedMin() * size}s`;
    jiggle.appendChild(flakeImage);
    jiggle.style.transform = `scale(${Math.random() * 0.75 + 0.25}, ${Math.random() * 0.75 + 0.25})`;
    jiggle.style.opacity = size;

    flake.appendChild(jiggle);
    flake.style.animationDelay = `${Math.random() * effect.getSpeedMax()}s`;
    flake.style.animationDuration = `${effect.getSpeedMax() - Math.random() * effect.getSpeedMin() * size}s`;

    return flake;
}

Module.register("MMM-DynamicWeather", {
    defaults: {
        particleCount: 100,
        api_key: "",
        locationID: 0,
        lat: 0,
        lon: 0,
        weatherInterval: 600000,
        alwaysDisplay: "",
        zIndex: 99,
        opacity: 1,
        fadeDuration: 3000,
        effectDuration: 120000,
        effectDelay: 60000,
        realisticClouds: false,
        hideSun: false,
        hideMoon: false,
        hideSnow: false,
        hideSnowman: true,
        hideRain: false,
        hideFlower: true,
        hideClouds: false,
        hideFog: false,
        hideLightning: false,
        lightning1Count: 2,
        lightning2Count: 3,
        sequential: "",
        sunImage: "sun_right",
        effects: [],
    },
    start() {
        Log.info("Starting MMM-DynamicWeather");
        this.now = new Date();
        this.initialized = false;
        this.weatherLoaded = false;
        this.holidayLoaded = false;
        this.doShowEffects = true;
        this.hasDateEffectsToDisplay = false;
        this.hasHolidayEffectsToDisplay = false;
        this.hasWeatherEffectsToDisplay = true;
        this.effectDurationTimeout = null;
        this.effectDelayTimeout = null;
        this.weatherTimeout = null;
        this.holidayTimeout = null;
        this.allEffects = [];
        this.url = `https://api.openweathermap.org/data/2.5/weather?appid=${this.config.api_key}`;
        if (this.config.lat && this.config.lon) {
            this.url += `&lat=${this.config.lat}&lon=${this.config.lon}`;
        }
        if (this.config.locationID) {
            this.url += `&id=${this.config.locationID}`;
        }
        this.snowEffect = new Effect();
        this.snowEffect.images = ["snow1.png", "snow2.png", "snow3.png"];
        this.snowEffect.size = 1;
        this.snowEffect.direction = "down";
        this.realisticCloudsEffect = new Effect();
        this.realisticCloudsEffect.size = 15;
        this.realisticCloudsEffect.direction = "left-right";
        this.realisticCloudsEffect.images = ["cloud1.png", "cloud2.png"];
        this.weatherCode = 0;
        this.sunrise = 0;
        this.sunset = 0;
        this.allHolidays = [];
        let count = 0;
        this.config.effects.forEach((configEffect) => {
            const effect = new Effect();
            effect.clone(configEffect);
            effect.id = count;
            count++;
            this.allEffects.push(effect);
            this.allHolidays.push(effect.holiday);
        });
        this.lastSequentialId = -1;
        this.lastSequential = this.config.sequential === "effect" || this.config.sequential === "effect-one" ? "weather" : this.config.sequential === "weather" ? "effect" : "";
        this.checkDates();
        if (this.allHolidays.length > 0) {
            this.getHolidays(this);
        } else {
            this.holidayLoaded = true;
        }
        if (!this.config.alwaysDisplay) {
            this.getWeather(this);
        } else {
            this.weatherLoaded = true;
        }
        Log.info("[MMM-DynamicWeather] Finished initialization");
    },
    getStyles() {
        return ["MMM-DynamicWeather.css"];
    },
    isTodayInDateRange(dateRange) {
        const [startDateStr, endDateStr] = dateRange.split(" to ").map(s => s.trim());
        if (!startDateStr || !endDateStr || isNaN(Date.parse(startDateStr)) || isNaN(Date.parse(endDateStr))) {
            console.error("Invalid date range format. Use 'YYYY-MM-DD to YYYY-MM-DD'.", dateRange);
            throw new Error("Invalid date range format. Use 'YYYY-MM-DD to YYYY-MM-DD'.");
        }
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today >= startDate && today <= endDate;
    },
    isTodayInAnyDateRange(dateRanges) {
        for (const dateRange of dateRanges) {
            if (this.isTodayInDateRange(dateRange)) {
                return true;
            }
        }
        return false;
    },
    checkDates() {
        try {
            this.allEffects.forEach((effect) => {
                const effectMonth = effect.getMonth() - 1;
                if (effect.hasWeatherCode() || effect.hasHoliday()) {
                    console.log("Ignoring dates for effect due to weatherCode or holiday being set. Effect: ", effect);
                    return;
                }
                if (this.isTodayInAnyDateRange(effect.getDateRanges())) {
                    this.hasDateEffectsToDisplay = true;
                    effect.doDisplay = true;
                    return;
                }
                if (effect.getMonth() === 0 && effect.getDay() === 0 && effect.getYear() === 0) {
                    if (effect.recurrence === "weekdays" && this.now.getDay() !== 6 && this.now.getDay() !== 0) {
                        this.hasDateEffectsToDisplay = true;
                        effect.doDisplay = true;
                    } else if (effect.recurrence === "weekends" && (this.now.getDay() === 6 || this.now.getDay() === 0)) {
                        this.hasDateEffectsToDisplay = true;
                        effect.doDisplay = true;
                    }
                } else if (this.now.getMonth() === effectMonth && this.now.getDate() === effect.day && (effect.getYear() === 0 || this.now.getFullYear() === effect.getYear())) {
                    this.hasDateEffectsToDisplay = true;
                    effect.doDisplay = true;
                } else if (effect.recurrence === "monthly" && this.now.getDate() === effect.getDay()) {
                    this.hasDateEffectsToDisplay = true;
                    effect.doDisplay = true;
                } else if (effect.recurrence === "weekly" && this.now.getDay() === new Date(effect.getYear(), effectMonth, effect.getDay()).getDay()) {
                    this.hasDateEffectsToDisplay = true;
                    effect.doDisplay = true;
                }
            });
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in checkDates: ", error);
        }
    },
    getDom() {
        const wrapper = document.createElement("div");
        wrapper.style.zIndex = this.config.zIndex;
        wrapper.style.opacity = this.config.opacity;
        wrapper.className = "wrapper";

        if (!this.weatherLoaded || !this.holidayLoaded || !this.doShowEffects) return wrapper;

        const fadeDuration = parseInt(this.config.fadeDuration);
        const animationDelay = parseInt(this.config.effectDuration) - fadeDuration;
        const fadeCSS = document.createElement("style");
        fadeCSS.innerHTML = `.fade-out {animation-name: fade; animation-duration: ${fadeDuration}ms; animation-delay: ${animationDelay}ms;}`;
        wrapper.prepend(fadeCSS);
        wrapper.onanimationend = (e) => {
            if (e.animationName === "fade") wrapper.remove();
        };

        if (this.config.alwaysDisplay) {
            this.displayAlwaysEffect(wrapper);
            return wrapper;
        }

        if (!this.weatherLoaded || !this.holidayLoaded || !this.doShowEffects) return wrapper;

        wrapper.className = "wrapper fade-out";
        let showEffects = false;
        let showWeather = false;

        if (this.hasDateEffectsToDisplay || this.hasHolidayEffectsToDisplay || this.hasWeatherEffectsToDisplay) {
            if (this.lastSequential === "effect" && this.hasWeatherEffectsToDisplay) {
                showWeather = true;
                this.lastSequential = "weather";
            } else if (this.lastSequential === "weather" && (this.hasDateEffectsToDisplay || this.hasHolidayEffectsToDisplay)) {
                showEffects = true;
                this.lastSequential = "effect";
            } else {
                showWeather = true;
                showEffects = true;
            }
        }

        if (showEffects) {
            this.displayEffects(wrapper);
        }

        if (showWeather) {
            this.displayWeatherEffects(wrapper);
        }

        console.info("[MMM-DynamicWeather] Displaying effects for: ", this.config.effectDuration);
        this.effectDurationTimeout = setTimeout(this.stopEffect, this.config.effectDuration, this);

        return wrapper;
    },
    displayAlwaysEffect(wrapper) {
        switch (this.config.alwaysDisplay) {
            case "snow":
                this.showCustomEffect(wrapper, this.snowEffect);
                if (!this.config.hideSnowman) this.buildSnowman(wrapper);
                break;
            case "sun":
                this.makeItSunny(wrapper);
                break;
            case "moon":
                this.makeItMoon(wrapper);
                break;
            case "rain":
                this.makeItRain(wrapper);
                if (!this.config.hideFlower) this.buildFlower(wrapper);
                break;
            case "lightning":
                this.makeItLightning(wrapper);
                break;
            case "rain-lightning":
                this.makeItRain(wrapper);
                this.makeItLightning(wrapper);
                break;
            case "cloudy":
                if (this.config.realisticClouds) {
                    this.showCustomEffect(wrapper, this.realisticCloudsEffect);
                } else {
                    this.makeItCloudy(wrapper);
                }
                break;
            case "fog":
                this.makeItFoggy(wrapper);
                break;
            default:
                console.error("[MMM-DynamicWeather] Invalid config option 'alwaysDisplay'");
        }
    },
    displayEffects(wrapper) {
        for (const effect of this.allEffects) {
            if (effect.doDisplay) {
                if (this.config.sequential === "effect-one") {
                    if (this.lastSequentialId < effect.id) {
                        this.lastSequentialId = effect.id;
                        if (this.allEffects.length - 1 === this.lastSequentialId) {
                            this.lastSequentialId = -1;
                        }
                        this.showCustomEffect(wrapper, effect);
                        break;
                    }
                } else {
                    this.showCustomEffect(wrapper, effect);
                }
            }
        }
    },
    displayWeatherEffects(wrapper) {
        if (this.weatherCode >= 600 && this.weatherCode <= 622 && !this.config.hideSnow) {
            this.showCustomEffect(wrapper, this.snowEffect);
            if (!this.config.hideSnowman) this.buildSnowman(wrapper);
            if (this.weatherCode >= 611 && this.weatherCode <= 622 && !this.config.hideRain) {
                this.makeItRain(wrapper);
            }
        } else if (this.weatherCode >= 200 && this.weatherCode <= 531 && !this.config.hideRain) {
            this.makeItRain(wrapper);
            if (!this.config.hideFlower) this.buildFlower(wrapper);
            if (this.weatherCode >= 200 && this.weatherCode <= 232 && !this.config.hideLightning) {
                this.makeItLightning(wrapper);
            }
        } else if (this.weatherCode >= 801 && this.weatherCode <= 804 && !this.config.hideClouds) {
            if (this.config.realisticClouds) {
                if (this.weatherCode === 801) {
                    this.realisticCloudsEffect.size = 8;
                    this.realisticCloudsEffect.particleCount = 30;
                    this.realisticCloudsEffect.images = ["cloud1.png"];
                } else if (this.weatherCode === 802) {
                    this.realisticCloudsEffect.size = 8;
                    this.realisticCloudsEffect.particleCount = 50;
                    this.realisticCloudsEffect.images = ["cloud1.png", "cloud2.png"];
                } else if (this.weatherCode === 803) {
                    this.realisticCloudsEffect.size = 15;
                    this.realisticCloudsEffect.particleCount = 30;
                    this.realisticCloudsEffect.images = ["cloud1.png", "cloud2.png"];
                } else if (this.weatherCode === 804) {
                    this.realisticCloudsEffect.size = 15;
                    this.realisticCloudsEffect.particleCount = 30;
                    this.realisticCloudsEffect.images = ["cloud3.png", "cloud2.png", "cloud1.png"];
                }
                this.showCustomEffect(wrapper, this.realisticCloudsEffect);
            } else {
                this.makeItCloudy(wrapper);
            }
        } else if (this.weatherCode >= 701 && this.weatherCode <= 781 && !this.config.hideFog) {
            this.makeItFoggy(wrapper);
        } else if (this.weatherCode === 800 && !this.config.hideSun && this.sunset > (Date.now() / 1000) && this.sunrise < (Date.now() / 1000)) {
            this.makeItSunny(wrapper);
        } else if (this.weatherCode === 800 && !this.config.hideMoon) {
            this.makeItMoon(wrapper);
        }
    },
    showCustomEffect(wrapper, effect) {
        this.doShowEffects = false;
        const particleCount = effect.getParticleCount() > 0 ? effect.getParticleCount() : this.config.particleCount;

        for (let i = 0; i < particleCount; i++) {
            const size = effect.getSize();
            const flake = createFlake(effect, size);
            wrapper.appendChild(flake);
        }
    },
    buildSnowman(wrapper) {
        this.doShowEffects = false;
        const snowmanImage = document.createElement("div");
        snowmanImage.classList.add("snowman");
        snowmanImage.style.animationDuration = `${this.config.effectDuration - 10000}ms`;
        wrapper.appendChild(snowmanImage);
    },
    makeItRain(wrapper) {
        this.doShowEffects = false;
        let increment = 0;
        while (increment < this.config.particleCount) {
            const randoHundo = Math.floor(Math.random() * 98) + 1;
            const randoFiver = Math.floor(Math.random() * 4) + 2;
            increment += randoFiver;
            const frontDrop = document.createElement("div");
            frontDrop.classList.add("drop");
            frontDrop.style.left = `${increment}%`;
            frontDrop.style.bottom = `${randoFiver + randoFiver - 1 + 100}%`;
            frontDrop.style.animationDelay = `1.${randoHundo}s`;
            frontDrop.style.animationDuration = `1.5${randoHundo}s`;
            const frontStem = document.createElement("div");
            frontStem.classList.add("stem");
            frontStem.style.animationDelay = `1.${randoHundo}s`;
            frontStem.style.animationDuration = `1.5${randoHundo}s`;
            frontDrop.appendChild(frontStem);
            const backDrop = document.createElement("div");
            backDrop.classList.add("drop");
            backDrop.style.opacity = "0.5";
            backDrop.style.right = `${increment}%`;
            backDrop.style.bottom = `${randoFiver + randoFiver - 1 + 100}%`;
            backDrop.style.animationDelay = `1.${randoHundo}s`;
            backDrop.style.animationDuration = `1.5${randoHundo}s`;
            const backStem = document.createElement("div");
            backStem.classList.add("stem");
            backStem.style.animationDelay = `1.${randoHundo}s`;
            backStem.style.animationDuration = `1.5${randoHundo}s`;
            backDrop.appendChild(backStem);
            wrapper.appendChild(backDrop);
            wrapper.appendChild(frontDrop);
        }
    },
    buildFlower(wrapper) {
        this.doShowEffects = false;
        const flowerImage = document.createElement("div");
        flowerImage.classList.add("flower");
        flowerImage.style.animationDuration = `${this.config.effectDuration - 10000}ms`;
        wrapper.appendChild(flowerImage);
    },
    makeItLightning(wrapper) {
        this.doShowEffects = false;
        const lightningImage1 = document.createElement("div");
        lightningImage1.classList.add("lightning1");
        lightningImage1.style.animationIterationCount = this.config.lightning1Count;
        const lightningImage2 = document.createElement("div");
        lightningImage2.classList.add("lightning2");
        lightningImage2.style.animationIterationCount = this.config.lightning2Count;
        const lightningPlayer = document.createElement("div");
        lightningPlayer.classList.add("lightningPlayer");
        lightningPlayer.appendChild(lightningImage1);
        lightningPlayer.appendChild(lightningImage2);
        wrapper.appendChild(lightningPlayer);
    },
    makeItSunny(wrapper) {
        this.doShowEffects = false;
        const sunImage = document.createElement("div");
        sunImage.classList.add("sun");
        sunImage.style.background = `url('./modules/MMM-DynamicWeather/images/${this.config.sunImage}.png') center center/cover no-repeat transparent`;
        const sunPlayer = document.createElement("div");
        sunPlayer.classList.add("sunPlayer");
        sunPlayer.appendChild(sunImage);
        wrapper.appendChild(sunPlayer);
    },
    makeItMoon(wrapper) {
        this.doShowEffects = false;
        const moonImage = document.createElement("div");
        moonImage.classList.add("moon");
        moonImage.style.background = "url('./modules/MMM-DynamicWeather/images/moon1.png') center center/cover no-repeat transparent";
        const moonPlayer = document.createElement("div");
        moonPlayer.classList.add("moonPlayer");
        moonPlayer.appendChild(moonImage);
        wrapper.appendChild(moonPlayer);
    },
    makeItCloudy(wrapper) {
        this.doShowEffects = false;
        let increment = 0;
        while (increment < this.config.particleCount) {
            const randNum = Math.floor(Math.random() * 21) + 5;
            const speed = Math.floor(Math.random() * 21) + 15;
            const size = Math.floor(Math.random() * 58) + 3;
            increment += randNum;
            const cloudBase = document.createElement("div");
            cloudBase.style.animation = `animateCloud ${speed}s linear infinite`;
            cloudBase.style.transform = `scale(0.${size})`;
            const cloud = document.createElement("div");
            cloud.classList.add("cloud");
            cloudBase.appendChild(cloud);
            wrapper.appendChild(cloudBase);
        }
    },
    makeItFoggy(wrapper) {
        this.doShowEffects = false;
        const fogImage1 = document.createElement("div");
        fogImage1.classList.add("image01");
        const fogImage2 = document.createElement("div");
        fogImage2.classList.add("image02");
        const fogPlayer1 = document.createElement("div");
        fogPlayer1.id = "foglayer_01";
        fogPlayer1.classList.add("fog");
        fogPlayer1.appendChild(fogImage1);
        fogPlayer1.appendChild(fogImage2);
        wrapper.appendChild(fogPlayer1);
        const fogPlayer2 = this.createFogPlayer("foglayer_02");
        wrapper.appendChild(fogPlayer2);
        const fogPlayer3 = this.createFogPlayer("foglayer_03");
        wrapper.appendChild(fogPlayer3);
    },
    createFogPlayer(id) {
        const fogImage1 = document.createElement("div");
        fogImage1.classList.add("image01");
        const fogImage2 = document.createElement("div");
        fogImage2.classList.add("image02");
        const fogPlayer = document.createElement("div");
        fogPlayer.id = id;
        fogPlayer.classList.add("fog");
        fogPlayer.appendChild(fogImage1);
        fogPlayer.appendChild(fogImage2);
        return fogPlayer;
    },
    stopEffect(_this) {
        try {
            _this.updateDom();
            const delay = _this.config.effectDelay;
            _this.effectDelayTimeout = setTimeout(function (_that) {
                _that.doShowEffects = true;
                _that.updateDom();
            }, delay, _this);
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in stopping effects: ", error);
        }
    },
    getWeather(_this) {
        _this.sendSocketNotification("API-Fetch", _this.url);
        _this.weatherTimeout = setTimeout(_this.getWeather, _this.config.weatherInterval, _this);
    },
    getHolidays(_this) {
        try {
            _this.sendSocketNotification("Holiday-Fetch", {});
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const msTillMidnight = tomorrow - today;
            console.info(`[MMM-DynamicWeather] Holidays have been fetched, waiting till midnight (${msTillMidnight} ms) to reset.`);
            _this.holidayTimeout = setTimeout(_this.resetHolidays, msTillMidnight, _this);
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in getHolidays: ", error);
        }
    },
    resetHolidays(_this) {
        try {
            console.info("[MMM-DynamicWeather] Resetting holidays...");
            _this.allEffects.forEach((effect) => {
                if (effect.holiday) {
                    effect.doDisplay = false;
                }
            });
            _this.hasHolidayEffectsToDisplay = false;
            _this.updateDom();
            console.info("[MMM-DynamicWeather] Holidays reset.");
            _this.getHolidays(_this);
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in resetting holidays: ", error);
        }
    },
    parseHolidays(body) {
        const today = new Date();
        const todayHolidays = ["test"];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(body, "text/html");
            const children = doc.getElementById("holidays-table").children[1].children;
            for (const child1 of children) {
                if (child1.hasAttribute("data-date")) {
                    const holidayDateStr = child1.getAttribute("data-date");
                    const holidayDate = new Date(parseInt(holidayDateStr));
                    if (holidayDate.getUTCDate() === today.getDate() && holidayDate.getUTCMonth() === today.getMonth()) {
                        for (const child3 of child1.children) {
                            for (const child4 of child3.children) {
                                for (const effectHoliday of this.allHolidays) {
                                    if (child4.textContent === effectHoliday) {
                                        todayHolidays.push(effectHoliday);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in parsing holidays: ", error);
        }
        return todayHolidays;
    },
    socketNotificationReceived(notification, payload) {
        try {
            if (notification === "API-Received" && payload.url === this.url) {
                this.weatherLoaded = true;
                if (!payload.success) {
                    console.error("[MMM-DynamicWeather] API-Received failure status");
                    return;
                }
                const newCode = payload.result.weather[0].id;
                this.sunrise = payload.result.sys.sunrise;
                this.sunset = payload.result.sys.sunset;
                let doUpdate = false;
                if (newCode !== this.weatherCode) {
                    this.weatherCode = newCode;
                    if (this.shouldUpdateWeather(newCode)) {
                        doUpdate = true;
                    }
                    this.allEffects.forEach((effect) => {
                        if (effect.getWeatherCode() === newCode || (effect.getMinWeatherCode() <= newCode && effect.getMaxWeatherCode() >= newCode)) {
                            doUpdate = true;
                            effect.doDisplay = true;
                            this.hasWeatherEffectsToDisplay = true;
                        }
                    });
                }
                if (doUpdate || (this.holidayLoaded && (this.hasDateEffectsToDisplay || this.hasHolidayEffectsToDisplay))) {
                    this.doShowEffects = true;
                    clearTimeout(this.effectDurationTimeout);
                    clearTimeout(this.effectDelayTimeout);
                    this.updateDom();
                }
            }
            if (notification === "Holiday-Received") {
                this.holidayLoaded = true;
                if (!payload.success) {
                    console.error("[MMM-DynamicWeather] Holiday-Received failure status");
                    return;
                }
                let doUpdate = false;
                const todayHolidays = this.parseHolidays(payload.result.holidayBody);
                this.allEffects.forEach((effect) => {
                    todayHolidays.forEach((holidayName) => {
                        if (effect.holiday === holidayName) {
                            doUpdate = true;
                            effect.doDisplay = true;
                            this.hasHolidayEffectsToDisplay = true;
                        }
                    });
                });
                if (doUpdate || (this.weatherLoaded && (this.hasDateEffectsToDisplay || this.hasWeatherEffectsToDisplay))) {
                    this.doShowEffects = true;
                    clearTimeout(this.effectDurationTimeout);
                    clearTimeout(this.effectDelayTimeout);
                    this.updateDom();
                }
            }
        } catch (error) {
            console.error("[MMM-DynamicWeather] Error occurred in notification received: ", error);
        }
    },
    shouldUpdateWeather(newCode) {
        return (newCode >= 600 && newCode <= 622 && !this.config.hideSnow) ||
            ((newCode >= 200 && newCode <= 531) || (newCode >= 611 && newCode <= 622 && !this.config.hideRain)) ||
            (newCode >= 200 && newCode <= 232 && !this.config.hideLightning) ||
            (newCode >= 801 && newCode <= 804 && !this.config.hideClouds) ||
            (newCode >= 701 && newCode <= 781 && !this.config.hideFog) ||
            (newCode === 800 && !this.config.hideSun);
    }
});
