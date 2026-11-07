const filterButtons = document.querySelectorAll('.filter');
const postCards = document.querySelectorAll('.post-card');
const emptyState = document.querySelector('.empty-state');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const selected = button.dataset.filter;
    let visibleCount = 0;
    postCards.forEach((card) => {
      const visible = selected === 'All' || card.dataset.category === selected;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    emptyState.hidden = visibleCount !== 0;
  });
});

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav-links');
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('open', !expanded);
});
navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

document.querySelector('.signup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('.form-success').hidden = false;
  event.currentTarget.reset();
});
