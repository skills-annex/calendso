export default function Logo({ small, icon }: { small?: boolean; icon?: boolean }) {
  return (
    <div className="inline">
      {icon ? (
        <img
          className="w-9 mx-auto"
          alt="the skills logo"
          title="The Skills"
          src="/the-skills-logo-small-black.svg"
        />
      ) : (
        <img
          className={small ? "h-5 w-auto" : "h-6 w-auto"}
          alt="the skills logo"
          title="The Skills"
          src="/the-skills-logo-black.svg"
        />
      )}
    </div>
  );
}
