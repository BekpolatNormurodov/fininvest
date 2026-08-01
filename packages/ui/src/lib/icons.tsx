/**
 * Central icon system — Iconsax across the whole product.
 * Wrapped so icons inherit `currentColor` and accept Tailwind sizing via
 * className (h-4 w-4 …). Semantic names mirror usage sites.
 */
import * as Iso from 'iconsax-react';

type Variant = 'Linear' | 'Outline' | 'Bold' | 'Bulk' | 'TwoTone' | 'Broken';
export type IconProps = { className?: string; size?: number; variant?: Variant };

function make(Cmp: any, defaultVariant: Variant = 'Linear') {
  return function Icon({ className, size = 20, variant }: IconProps) {
    return <Cmp className={className} size={size} color="currentColor" variant={variant ?? defaultVariant} />;
  };
}

export const ShieldCheck = make(Iso.ShieldTick);
export const LogIn = make(Iso.Login);
export const LogOut = make(Iso.Logout);
export const Menu = make(Iso.HambergerMenu);
export const Bell = make(Iso.Notification);
export const X = make(Iso.CloseCircle);
export const Category = make(Iso.Category);
export const Filter = make(Iso.Filter ?? Iso.Sort);
export const Settings = make(Iso.Setting2);
export const Chart = make(Iso.Chart);
export const FileText = make(Iso.DocumentText);
export const Download = make(Iso.DocumentDownload);
export const Upload = make(Iso.DocumentUpload);
export const Eye = make(Iso.Eye);
export const EyeOff = make(Iso.EyeSlash);
export const Send = make(Iso.Send2);
export const Paperclip = make(Iso.Paperclip);
export const Search = make(Iso.SearchNormal1);
export const Plus = make(Iso.Add);
export const Trash = make(Iso.Trash);
export const Save = make(Iso.Save2);
export const Check = make(Iso.TickCircle);
export const Return = make(Iso.Refresh);
export const Flag = make(Iso.Flag);
export const Edit = make(Iso.Edit2);
export const Building = make(Iso.Building);
export const UserAdd = make(Iso.UserAdd);
export const Money = make(Iso.MoneyRecive);
export const Bank = make(Iso.Bank);
export const Layers = make(Iso.Element3);
export const FileCheck = make(Iso.TaskSquare);
export const Info = make(Iso.InfoCircle);
export const Inbox = make(Iso.Folder2);
export const Spreadsheet = make(Iso.Document);
export const Application = make(Iso.ClipboardText);
export const House = make(Iso.House2 ?? Iso.House ?? Iso.Home2);
export const Car = make(Iso.Car);
export const ArrowRight = make(Iso.ArrowRight);
export const Calculator = make(Iso.Calculator);
export const Messages = make(Iso.Messages2 ?? Iso.Message ?? Iso.Sms);
export const Buildings = make(Iso.Buildings2 ?? Iso.Building);
export const ChevronDown = make(Iso.ArrowDown2);
export const Calendar = make(Iso.Calendar);
export const Sun = make(Iso.Sun1);
export const Moon = make(Iso.Moon);
export const Globe = make(Iso.Global);
export const User = make(Iso.User);
export const Warning = make(Iso.Warning2 ?? Iso.Danger);
export const Lock = make(Iso.Lock1 ?? Iso.Lock);
export const Phone = make(Iso.Call);
export const Copy = make(Iso.Copy);
export const IdCard = make(Iso.Personalcard ?? Iso.Card);
export const Location = make(Iso.Location ?? Iso.Map1);
export const Hashtag = make(Iso.Hashtag);
export const Ruler = make(Iso.Ruler ?? Iso.Maximize3);
export const Percent = make(Iso.PercentageSquare ?? Iso.Chart);
export const Clock = make(Iso.Clock);
export const Tag = make(Iso.Tag);
export const Camera = make(Iso.Camera);
export const People = make(Iso.People ?? Iso.User);
export const Palette = make(Iso.Colorfilter ?? Iso.Brush);
export const Minus = make(Iso.Minus);
export const Volume = make(Iso.VolumeHigh ?? Iso.Volume);
export const VolumeOff = make(Iso.VolumeSlash ?? Iso.VolumeCross);
export const Pause = make(Iso.Pause ?? Iso.PauseCircle);
export const Play = make(Iso.Play ?? Iso.PlayCircle);
export const Key = make(Iso.Key);
/** E-IMZO unavailable — the shield with a slash, distinct from `Warning`. */
export const ShieldOff = make(Iso.ShieldSlash);

// Aliases matching prior (lucide) names so call sites need no JSX changes.
export const CheckCircle2 = Check;
export const RotateCcw = Return;
export const FilePlus2 = Application;
export const FileDown = Download;
export const FileSpreadsheet = Spreadsheet;
export const Trash2 = Trash;
export const Building2 = Building;
export const UserPlus = UserAdd;
export const Banknote = Money;
export const FileCheck2 = FileCheck;
export const Landmark = Bank;
export const BarChart3 = Chart;
export const LayoutGrid = Category;
export const Pencil = Edit;
