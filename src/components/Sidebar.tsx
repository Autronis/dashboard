"use client";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Projecten", href: "/projecten" },
  { label: "Instellingen", href: "/instellingen" },
];

export default function Sidebar() {
  return (
    <aside className="
      fixed top-16 left-0
      h-[calc(100vh-4rem)] w-64
      bg-white dark:bg-gray-900
      border-r border-gray-200 dark:border-gray-700
      text-gray-900 dark:text-gray-100
      transition-colors duration-300
      flex flex-col
      py-4
    ">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="
              rounded-md px-3 py-2
              text-sm font-medium
              text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-800
              transition-colors duration-200
            "
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
