"use client";

import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <nav className="
      fixed top-0 left-0 right-0 z-50
      h-16 px-6
      flex items-center justify-between
      bg-white dark:bg-gray-900
      border-b border-gray-200 dark:border-gray-700
      text-gray-900 dark:text-gray-100
      transition-colors duration-300
    ">
      <span className="font-semibold text-lg">Autronis</span>
      <ThemeToggle />
    </nav>
  );
}
