Firefox is broken due to them not pupulating the UIEvent "which" field for extension simulated inputs. But the discord web client evaluated this field.

The portal is broken on KDE <= 6.0.3 and generally until (https://bugs.kde.org/show_bug.cgi?id=484525) is fixed. On Gnome it is not implemented (https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome/-/issues/47). It might work on hyprland though (not tested).

So this serves currently no purpose.

To try it you have to install the native part AND the actual browser extension.
- Clone the repository somewhere
- Run Install.sh
- Load the addon into your browser (See your respective browsers guide on how to manually load local addons)
- After the first launch the bind should show up wherever your DE puts xdg-desktop-portal key bindings

Interface work with discord web app based on:
https://github.com/mjmartis/discord_web_sys_ptt
