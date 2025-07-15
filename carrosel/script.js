class Carousel {
    constructor(selector, options = {}) {
        this.carouselElement = document.querySelector(selector);
        if (!this.carouselElement) {
            throw new Error(`Elemento com selector "${selector}" não encontrado.`);
        }
        this.items = this.carouselElement.querySelectorAll('.carousel-item');
        if (this.items.length === 0) {
            throw new Error('Nenhum item de carousel encontrado.');
        }
        this.wrapper = this.carouselElement.querySelector('.carousel-wrapper');
        if (!this.wrapper) {
            throw new Error('Elemento .carousel-wrapper não encontrado.');
        }
        this.index = 0;
        this.options = {
            autoScroll: options.autoScroll || false,
            autoScrollInterval: options.autoScrollInterval || 3000,
            slideSpeed: options.slideSpeed || '0.5s',
            showDots: options.showDots || false,
            pauseOnHover: options.pauseOnHover ?? true,
        };
        this.autoInterval = null;
        if (this.options.showDots) {
            this.createDots();
        }
        this.init();
    }

    createDots() {
        const dotsContainer = document.createElement('div');
        dotsContainer.classList.add('dots');
        dotsContainer.setAttribute('role', 'tablist');
        this.items.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.classList.add('dot');
            dot.dataset.index = index;
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Slide ${index + 1}`);
            dot.addEventListener('click', () => this.goToSlide(index));
            dotsContainer.appendChild(dot);
        });
        this.carouselElement.appendChild(dotsContainer);
        // Setar inicial ativo
        dotsContainer.querySelector('.dot[data-index="0"]').classList.add('active');
        dotsContainer.querySelector('.dot[data-index="0"]').setAttribute('aria-selected', 'true');
    }

    init() {
        this.wrapper.style.transition = `transform ${this.options.slideSpeed} ease-in-out`;
        this.updateCarousel();
        this.addEventListeners();
        if (this.options.autoScroll) this.startAutoScroll();
    }

    addEventListeners() {
        const prevBtn = this.carouselElement.querySelector('.prev');
        const nextBtn = this.carouselElement.querySelector('.next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.next());

        // Suporte a teclado
        this.carouselElement.setAttribute('tabindex', '0'); // Para focar
        this.carouselElement.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Suporte a touch
        let touchStartX = 0;
        this.wrapper.addEventListener('touchstart', (e) => touchStartX = e.touches[0].clientX);
        this.wrapper.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            if (touchStartX - touchEndX > 50) this.next();
            if (touchEndX - touchStartX > 50) this.prev();
        });

        // Pause on hover
        if (this.options.pauseOnHover && this.options.autoScroll) {
            this.carouselElement.addEventListener('mouseenter', () => this.stopAutoScroll());
            this.carouselElement.addEventListener('mouseleave', () => this.startAutoScroll());
        }
    }

    startAutoScroll() {
        this.stopAutoScroll();
        this.autoInterval = setInterval(() => this.next(), this.options.autoScrollInterval);
    }

    stopAutoScroll() {
        if (this.autoInterval) {
            clearInterval(this.autoInterval);
            this.autoInterval = null;
        }
    }

    prev() {
        this.index = (this.index > 0) ? this.index - 1 : this.items.length - 1;
        this.updateCarousel();
    }

    next() {
        this.index = (this.index < this.items.length - 1) ? this.index + 1 : 0;
        this.updateCarousel();
    }

    goToSlide(index) {
        this.index = index;
        this.updateCarousel();
    }

    updateCarousel() {
        const offset = -this.index * 100;
        this.wrapper.style.transform = `translateX(${offset}%)`;

        // Atualiza os dots
        if (this.options.showDots) {
            const dots = this.carouselElement.querySelectorAll('.dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === this.index);
                dot.setAttribute('aria-selected', i === this.index ? 'true' : 'false');
            });
        }
    }
}


