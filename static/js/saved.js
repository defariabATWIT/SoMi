const numbers = document.querySelectorAll(".number");

numbers.forEach(number => {
    number.addEventListener("click", function() {
        // Remove active class from all numbers
        numbers.forEach(num => num.classList.remove("active"));
        // Add active class to clicked number
        this.classList.add("active");
    });
});