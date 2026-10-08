import {
  Bus,
  Car,
  Fuel,
  Gift,
  GraduationCap,
  Heart,
  House,
  Landmark,
  type LucideIcon,
  MoreHorizontal,
  PiggyBank,
  Pill,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  Tv,
  Utensils,
  Wifi,
  Zap,
} from "lucide-react";

import { getCategoryIcon } from "@/modules/categories/lib/category-icons";

// Categories have no icon of their own yet (the column comes in a later
// phase), so the list guesses one from the name, then the category's group.
const KEYWORD_ICONS: [RegExp, LucideIcon][] = [
  [/lunch|dinner|breakfast|food|restaurant|dining|momo|snack|tea|coffee|cafe/, Utensils],
  [/grocer|bhatbhateni|vegetable|market/, ShoppingBasket],
  [/petrol|fuel|diesel|gas station/, Fuel],
  [/cloth|shirt|shoe/, Shirt],
  [/shop/, ShoppingBag],
  [/mobile|phone|telephone|top ?up|recharge/, Smartphone],
  [/internet|wifi|wi-fi|wlink|broadband/, Wifi],
  [/medic|pharma|hospital|health|doctor|clinic/, Pill],
  [/rent|house|home/, House],
  [/loan|emi|obligation|bank|tax|insurance/, Landmark],
  [/bus|taxi|transport|travel/, Bus],
  [/parking|vehicle|bike|car/, Car],
  [/electric|water|utility|utilities|bill/, Zap],
  [/gift/, Gift],
  [/school|tuition|course|education|book/, GraduationCap],
  [/saving/, PiggyBank],
  [/movie|netflix|entertainment|subscription/, Tv],
  [/skin|cosmetic|beauty|salon/, Sparkles],
  [/date|romance/, Heart],
];

export function guessCategoryIcon(name: string, groupName: string): LucideIcon {
  const lower = name.toLowerCase();
  const match = KEYWORD_ICONS.find(([pattern]) => pattern.test(lower));
  if (match) return match[1];
  const groupIcon = getCategoryIcon(groupName);
  return groupIcon === MoreHorizontal ? Tag : groupIcon;
}
