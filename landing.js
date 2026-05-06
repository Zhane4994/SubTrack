const detailContent = {
  costs: {
    title: "Track costs in one place",
    text: "See what every subscription costs each month and each year, compare categories, and catch duplicate services before they quietly drain your budget."
  },
  reminders: {
    title: "Get reminders before renewals hit",
    text: "Keep upcoming renewal dates visible, edit subscriptions quickly, and stay ahead of annual charges before they land on your statement."
  },
  savings: {
    title: "Save money without guesswork",
    text: "Use the dashboard to spot expensive categories, jump into a service, and decide what to cancel, downgrade, or keep."
  }
};

const detailTitle = document.getElementById("detailTitle");
const detailText = document.getElementById("detailText");
const featureCards = document.querySelectorAll(".feature-card");
const previewCard = document.getElementById("previewCard");
const learnMoreBtn = document.getElementById("learnMoreBtn");

function setDetail(target) {
  const content = detailContent[target];
  if (!content) {
    return;
  }

  detailTitle.textContent = content.title;
  detailText.textContent = content.text;

  featureCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.target === target);
  });
}

featureCards.forEach((card) => {
  card.addEventListener("click", () => {
    setDetail(card.dataset.target);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setDetail(card.dataset.target);
    }
  });

  card.tabIndex = 0;
  card.setAttribute("role", "button");
});

previewCard.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});

previewCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    window.location.href = "dashboard.html";
  }
});

learnMoreBtn.addEventListener("click", () => {
  document.getElementById("detailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

setDetail("costs");
