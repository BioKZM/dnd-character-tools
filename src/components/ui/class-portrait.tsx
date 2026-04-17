import Image, { StaticImageData } from "next/image";

import artificerImage from "../../../assets/Artificer.jpg";
import barbarianImage from "../../../assets/Barbarian.jpg";
import bardImage from "../../../assets/Bard.jpg";
import clericImage from "../../../assets/Cleric.jpg";
import druidImage from "../../../assets/Druid.jpg";
import fighterImage from "../../../assets/Fighter.jpg";
import monkImage from "../../../assets/Monk.jpg";
import paladinImage from "../../../assets/Paladin.jpg";
import rangerImage from "../../../assets/Ranger.jpg";
import rogueImage from "../../../assets/Rogue.jpg";
import sorcererImage from "../../../assets/Sorcerer.jpg";
import warlockImage from "../../../assets/Warlock.jpg";
import wizardImage from "../../../assets/Wizard.jpg";

const portraitMap: Record<string, StaticImageData> = {
  artificer: artificerImage,
  barbarian: barbarianImage,
  bard: bardImage,
  cleric: clericImage,
  druid: druidImage,
  fighter: fighterImage,
  monk: monkImage,
  paladin: paladinImage,
  ranger: rangerImage,
  rogue: rogueImage,
  sorcerer: sorcererImage,
  warlock: warlockImage,
  wizard: wizardImage,
};

export function ClassPortrait({
  classId,
  alt,
  className,
}: {
  classId: string;
  alt: string;
  className?: string;
}) {
  const src = portraitMap[classId] ?? wizardImage;

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      sizes="64px"
      quality={35}
      placeholder="blur"
      loading="lazy"
      decoding="async"
    />
  );
}
