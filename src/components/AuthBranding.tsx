import Image from "next/image";

export default function AuthBranding() {
  return (
    <div className="mb-6 flex justify-center">
      <Image
        src="/images/logo.jpg"
        alt="Familiekursus"
        width={128}
        height={128}
        className="rounded-2xl shadow-md"
        priority
      />
    </div>
  );
}
