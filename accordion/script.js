const accordionHeaders = document.querySelectorAll('.accordion--header');
accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const accordionBody = header.nextElementSibling;
        const accordionIcon = header.querySelector('.accordion--icon');
        const isActive = accordionBody.classList.contains('active');

        document.querySelectorAll('.accordion--body').forEach(body => {
            body.classList.remove('active');
            body.style.maxHeight = 0;
            body.style.padding = "0 20px";
        });

        document.querySelectorAll('.accordion--body').forEach(body => {
            body.classList.remove('active');
        });
        document.querySelectorAll('.accordion--icon').forEach(icon => {
            icon.style.transform = 'rotate(0deg)';
        });

        if (!isActive) {
            accordionBody.classList.add('active');
            accordionIcon.style.transform = 'rotate(180deg)';
            accordionBody.classList.add('active');
            accordionBody.style.maxHeight = accordionBody.scrollHeight + "px";
            accordionBody.style.padding = "15px 20px";
        }
    });
});